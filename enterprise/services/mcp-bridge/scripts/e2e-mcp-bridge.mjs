#!/usr/bin/env node

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// End-to-end validation of the MCP bridge against the real retrieval stack:
// seeds mixed-sensitivity chunks through the retrieval package's PostgreSQL
// contract, runs a mock NIM (embeddings, ranking), boots the retrieval API,
// spawns the bridge, then speaks MCP over the child's stdio and asserts tool
// discovery, role-aware search, ACL enforcement, and upstream health.
//
// Required environment: RETRIEVAL_API_DATABASE_URL (bootstrapped schema).
// Usage: node ./scripts/e2e-mcp-bridge.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const bridgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retrievalRoot = path.resolve(bridgeRoot, "..", "retrieval-api");
const EMBEDDING_DIMENSION = 1024;
const RETRIEVAL_PORT = 8094;
const RETRIEVAL_URL = `http://127.0.0.1:${RETRIEVAL_PORT}`;

function pseudoEmbed(text) {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  for (const token of text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash = Math.imul(hash ^ token.charCodeAt(i), 16777619);
    }
    vector[Math.abs(hash) % EMBEDDING_DIMENSION] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function startMockNim() {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    response.setHeader("content-type", "application/json");

    if (request.url === "/v1/embeddings") {
      const input = Array.isArray(body.input) ? body.input : [];
      response.end(
        JSON.stringify({
          data: input.map((text, index) => ({ index, embedding: pseudoEmbed(String(text)) })),
        }),
      );
      return;
    }

    if (request.url === "/v1/ranking") {
      const passages = Array.isArray(body.passages) ? body.passages : [];
      response.end(
        JSON.stringify({
          data: passages.map((_, index) => ({ index, relevance_score: 1 - index * 0.1 })),
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function seedDatabase() {
  // The bridge intentionally has no database dependency; resolve pg from the
  // sibling retrieval package, which owns the PostgreSQL contract.
  const requireFromRetrieval = createRequire(path.join(retrievalRoot, "package.json"));
  const pg = requireFromRetrieval("pg");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const seedChunks = [
    {
      id: "mcp-e2e-public",
      sourceId: "anf-overview.md",
      title: "Azure NetApp Files overview",
      collection: "enterprise-public",
      classification: "public",
      content: "Azure NetApp Files provides low latency NFS volumes for PostgreSQL.",
      aclPrincipals: [],
    },
    {
      id: "mcp-e2e-sensitive",
      sourceId: "bom-q2.xlsx",
      title: "Quarterly bill of materials",
      collection: "enterprise-sensitive",
      classification: "sensitive",
      content: "The quarterly bill of materials lists supplier pricing for storage controllers.",
      aclPrincipals: ["group:supply-chain"],
    },
  ];
  try {
    await client.query("DELETE FROM document_chunks WHERE id LIKE 'mcp-e2e-%'");
    for (const chunk of seedChunks) {
      await client.query(
        `INSERT INTO document_chunks
           (id, source_id, title, collection, classification, content, metadata, embedding, acl_principals)
         VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7::vector, $8)`,
        [
          chunk.id,
          chunk.sourceId,
          chunk.title,
          chunk.collection,
          chunk.classification,
          chunk.content,
          JSON.stringify(pseudoEmbed(`${chunk.title} ${chunk.content}`)),
          chunk.aclPrincipals,
        ],
      );
    }
  } finally {
    await client.end();
  }
}

function startProcess(cwd, env, stdio) {
  return spawn(process.execPath, ["--experimental-strip-types", "./src/index.ts"], {
    cwd,
    env: { ...process.env, ...env },
    stdio,
  });
}

async function waitForHealth(baseUrl, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${baseUrl} did not become healthy in time`);
}

// Minimal MCP stdio client: newline-delimited JSON-RPC over the child's pipes.
function createMcpClient(child) {
  const pending = new Map();
  let nextId = 1;

  const output = readline.createInterface({ input: child.stdout, terminal: false });
  output.on("line", (line) => {
    if (line.trim() === "") {
      return;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      console.error(`Non-JSON output from bridge stdout: ${line} (${error.message})`);
      return;
    }
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });

  return {
    request(method, params) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for response to ${method}`));
        }, 15000);
        pending.set(id, { resolve, timer });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },
    notify(method, params) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`MCP bridge E2E assertion failed: ${message}`);
  }
}

function toolText(response) {
  assert(response.error === undefined, `tool call errored: ${JSON.stringify(response.error)}`);
  const text = response.result?.content?.[0]?.text;
  assert(typeof text === "string", "tool result missing text content");
  return text;
}

const failures = [];
let mockNim;
let retrieval;
let bridge;

try {
  mockNim = await startMockNim();
  const nimBaseUrl = `http://127.0.0.1:${mockNim.address().port}`;
  await seedDatabase();

  retrieval = startProcess(
    retrievalRoot,
    {
      RETRIEVAL_API_BACKEND: "pgvector",
      RETRIEVAL_API_DATABASE_URL: databaseUrl,
      RETRIEVAL_API_HOST: "127.0.0.1",
      RETRIEVAL_API_PORT: String(RETRIEVAL_PORT),
      EMBEDDING_ENDPOINT: nimBaseUrl,
      RERANK_ENDPOINT: nimBaseUrl,
    },
    ["ignore", "inherit", "inherit"],
  );
  await waitForHealth(RETRIEVAL_URL);

  bridge = startProcess(bridgeRoot, { MCP_UPSTREAM_URL: RETRIEVAL_URL }, [
    "pipe",
    "pipe",
    "inherit",
  ]);
  const client = createMcpClient(bridge);

  const checks = [
    {
      name: "initialize handshake reports MCP tools capability",
      run: async () => {
        const response = await client.request("initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "mcp-bridge-e2e", version: "0.0.0" },
        });
        assert(response.result?.protocolVersion === "2025-06-18", "protocolVersion mismatch");
        assert(
          response.result?.serverInfo?.name === "nemomaxxing-mcp-bridge",
          "serverInfo.name mismatch",
        );
        assert(response.result?.capabilities?.tools !== undefined, "tools capability missing");
        client.notify("notifications/initialized", {});
      },
    },
    {
      name: "tools/list exposes retrieval_search and retrieval_health",
      run: async () => {
        const response = await client.request("tools/list", {});
        const names = (response.result?.tools ?? []).map((tool) => tool.name);
        assert(names.includes("retrieval_search"), "retrieval_search missing");
        assert(names.includes("retrieval_health"), "retrieval_health missing");
      },
    },
    {
      name: "field-agent retrieval_search grounds on public chunk only",
      run: async () => {
        const response = await client.request("tools/call", {
          name: "retrieval_search",
          arguments: {
            query: "low latency NFS volumes for PostgreSQL storage",
            role: "field-agent",
          },
        });
        const text = toolText(response);
        assert(response.result?.isError !== true, `tool reported error: ${text}`);
        assert(
          text.includes("Azure NetApp Files provides low latency NFS volumes"),
          "public chunk text missing from results",
        );
        assert(
          !text.includes("supplier pricing for storage controllers"),
          "field-agent leaked ACL-restricted chunk text",
        );
      },
    },
    {
      name: "denied collections are surfaced in the tool output",
      run: async () => {
        const response = await client.request("tools/call", {
          name: "retrieval_search",
          arguments: {
            query: "storage",
            role: "field-agent",
            collections: ["enterprise-public", "enterprise-sensitive"],
          },
        });
        const text = toolText(response);
        assert(
          text.includes("Denied collections: enterprise-sensitive"),
          "denied collections line missing",
        );
      },
    },
    {
      name: "retrieval_health reports the upstream boundary as healthy",
      run: async () => {
        const response = await client.request("tools/call", {
          name: "retrieval_health",
          arguments: {},
        });
        const payload = JSON.parse(toolText(response));
        assert(payload.ok === true, "upstream health not ok");
      },
    },
  ];

  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS ${check.name}`);
    } catch (error) {
      failures.push(`${check.name}: ${error.message}`);
      console.error(`FAIL ${check.name}: ${error.message}`);
    }
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error(error);
} finally {
  if (bridge) {
    bridge.kill("SIGTERM");
  }
  if (retrieval) {
    retrieval.kill("SIGTERM");
  }
  if (mockNim) {
    mockNim.close();
  }
}

if (failures.length > 0) {
  console.error(`MCP bridge E2E failed with ${failures.length} failure(s).`);
  process.exit(1);
}
console.log("MCP bridge E2E validation passed.");
process.exit(0);
