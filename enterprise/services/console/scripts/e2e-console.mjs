#!/usr/bin/env node

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// End-to-end validation of the console against the real retrieval stack:
// seeds the database through the retrieval package's e2e seed shape, runs a
// combined mock NIM (embeddings, ranking, chat completions), boots the
// retrieval API and the console, then asserts grounded chat and ACL
// enforcement through the console's public HTTP surface.
//
// Required environment: RETRIEVAL_API_DATABASE_URL (bootstrapped schema).
// Usage: node ./scripts/e2e-console.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const consoleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retrievalRoot = path.resolve(consoleRoot, "..", "retrieval-api");
const EMBEDDING_DIMENSION = 1024;

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

    if (request.url === "/v1/chat/completions") {
      // Deterministic mock Nemotron: proves the console delivered grounded
      // context by echoing which numbered passages were present.
      const userMessage = (body.messages ?? []).find((message) => message.role === "user");
      const passageCount = (userMessage?.content?.match(/^\[\d+\]/gm) ?? []).length;
      const mentionsBom = userMessage?.content?.includes("bill of materials") ?? false;
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `Grounded answer from ${passageCount} passages.${mentionsBom ? " The bill of materials is in context [1]." : ""}`,
              },
            },
          ],
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
  // The console intentionally has no database dependency; resolve pg from
  // the sibling retrieval package, which owns the PostgreSQL contract.
  const requireFromRetrieval = createRequire(path.join(retrievalRoot, "package.json"));
  const pg = requireFromRetrieval("pg");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const seedChunks = [
    {
      id: "console-e2e-public",
      sourceId: "anf-overview.md",
      title: "Azure NetApp Files overview",
      collection: "enterprise-public",
      classification: "public",
      content: "Azure NetApp Files provides low latency NFS volumes for PostgreSQL.",
      aclPrincipals: [],
    },
    {
      id: "console-e2e-sensitive",
      sourceId: "bom-q2.xlsx",
      title: "Quarterly bill of materials",
      collection: "enterprise-sensitive",
      classification: "sensitive",
      content: "The quarterly bill of materials lists supplier pricing for storage controllers.",
      aclPrincipals: ["group:supply-chain"],
    },
  ];
  try {
    await client.query("DELETE FROM document_chunks WHERE id LIKE 'console-e2e-%'");
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

function startProcess(cwd, env) {
  return spawn(process.execPath, ["--experimental-strip-types", "./src/index.ts"], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
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

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Console E2E assertion failed: ${message}`);
  }
}

const failures = [];
let mockNim;
let retrieval;
let consoleService;

try {
  mockNim = await startMockNim();
  const nimBaseUrl = `http://127.0.0.1:${mockNim.address().port}`;
  await seedDatabase();

  retrieval = startProcess(retrievalRoot, {
    RETRIEVAL_API_BACKEND: "pgvector",
    RETRIEVAL_API_DATABASE_URL: databaseUrl,
    RETRIEVAL_API_HOST: "127.0.0.1",
    RETRIEVAL_API_PORT: "8092",
    EMBEDDING_ENDPOINT: nimBaseUrl,
    RERANK_ENDPOINT: nimBaseUrl,
  });
  await waitForHealth("http://127.0.0.1:8092");

  consoleService = startProcess(consoleRoot, {
    CONSOLE_HOST: "127.0.0.1",
    CONSOLE_PORT: "8093",
    RETRIEVAL_API_URL: "http://127.0.0.1:8092",
    CHAT_ENDPOINT: nimBaseUrl,
    CHAT_MODEL: "mock/nemotron-e2e",
  });
  const consoleUrl = "http://127.0.0.1:8093";
  await waitForHealth(consoleUrl);
  console.log("console healthy against live retrieval stack");

  const checks = [
    {
      name: "serves the single-page console UI",
      run: async () => {
        const response = await fetch(consoleUrl);
        const html = await response.text();
        assert(response.status === 200, `expected 200, got ${response.status}`);
        assert(html.includes("NemoMaxxing Console"), "UI title missing");
      },
    },
    {
      name: "grounded chat answers with vault-agent principal context",
      run: async () => {
        const { status, body } = await postJson(`${consoleUrl}/api/chat`, {
          query: "What does the bill of materials say about supplier pricing?",
          role: "vault-agent",
          principals: ["group:supply-chain"],
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(body.answer.includes("Grounded answer"), "answer not grounded");
        assert(
          body.results.some((result) => result.id === "console-e2e-sensitive"),
          "ACL chunk missing from grounded context",
        );
        assert(body.model === "mock/nemotron-e2e", "model identity missing");
      },
    },
    {
      name: "field-agent chat cannot see ACL-restricted content",
      run: async () => {
        const { status, body } = await postJson(`${consoleUrl}/api/chat`, {
          query: "What does the bill of materials say about supplier pricing?",
          role: "field-agent",
          principals: ["group:supply-chain"],
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(
          !body.results.some((result) => result.id === "console-e2e-sensitive"),
          "field-agent leaked ACL-restricted chunk",
        );
      },
    },
    {
      name: "retrieval inspector endpoint forwards policy decisions",
      run: async () => {
        const { status, body } = await postJson(`${consoleUrl}/api/query`, {
          query: "storage",
          role: "field-agent",
          collections: ["enterprise-public", "enterprise-sensitive"],
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(
          body.policy.deniedCollections.includes("enterprise-sensitive"),
          "denied collections not surfaced",
        );
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
  if (consoleService) {
    consoleService.kill("SIGTERM");
  }
  if (retrieval) {
    retrieval.kill("SIGTERM");
  }
  if (mockNim) {
    mockNim.close();
  }
}

if (failures.length > 0) {
  console.error(`Console E2E failed with ${failures.length} failure(s).`);
  process.exit(1);
}
console.log("Console E2E validation passed.");
process.exit(0);
