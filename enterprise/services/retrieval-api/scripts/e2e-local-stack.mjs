#!/usr/bin/env node

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// End-to-end validation of the retrieval path against a live PostgreSQL
// deployment. Stands in for the embedding and reranking NIMs with local
// mock servers that honor the documented NIM request contracts, seeds a
// small corpus (public, sanitized, and ACL-restricted chunks), boots the
// retrieval API in pgvector mode, and asserts role and ACL enforcement
// through the public HTTP surface.
//
// Required environment: RETRIEVAL_API_DATABASE_URL (bootstrapped schema).
// Usage: node ./scripts/e2e-local-stack.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMBEDDING_DIMENSION = 1024;

// Deterministic pseudo-embedding: stable token hashing so that documents
// sharing vocabulary with the query land closer in cosine space.
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

function lexicalOverlap(query, passage) {
  const queryTokens = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const passageTokens = passage
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (passageTokens.length === 0) {
    return 0;
  }
  const hits = passageTokens.filter((token) => queryTokens.has(token)).length;
  return hits / passageTokens.length;
}

function startMockNim() {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

    if (request.url === "/v1/embeddings") {
      const input = Array.isArray(body.input) ? body.input : [];
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          data: input.map((text, index) => ({ index, embedding: pseudoEmbed(String(text)) })),
        }),
      );
      return;
    }

    if (request.url === "/v1/ranking") {
      const query = body.query?.text ?? "";
      const passages = Array.isArray(body.passages) ? body.passages : [];
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          data: passages
            .map((passage, index) => ({
              index,
              relevance_score: lexicalOverlap(query, passage?.text ?? ""),
            }))
            .sort((left, right) => right.relevance_score - left.relevance_score),
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

const seedChunks = [
  {
    id: "e2e-public-anf-overview",
    sourceId: "anf-overview.md",
    title: "Azure NetApp Files overview",
    collection: "enterprise-public",
    classification: "public",
    content:
      "Azure NetApp Files provides low latency NFS and SMB volumes for enterprise workloads including PostgreSQL.",
    aclPrincipals: [],
  },
  {
    id: "e2e-sanitized-runbook",
    sourceId: "ops-runbook.md",
    title: "Sanitized operations runbook",
    collection: "enterprise-internal-sanitized",
    classification: "internal-sanitized",
    content:
      "The retrieval API is the only path from the agent tier to enterprise knowledge stored in PostgreSQL.",
    aclPrincipals: [],
  },
  {
    id: "e2e-sensitive-bom",
    sourceId: "bom-q2.xlsx",
    title: "Quarterly bill of materials",
    collection: "enterprise-sensitive",
    classification: "sensitive",
    content:
      "The quarterly bill of materials lists supplier pricing for the PostgreSQL storage controllers.",
    aclPrincipals: ["group:supply-chain"],
  },
  {
    id: "e2e-regulated-contract",
    sourceId: "contract-acme.pdf",
    title: "Regulated supplier contract",
    collection: "enterprise-regulated",
    classification: "regulated",
    content: "Regulated contract terms for supplier ACME including penalty clauses and pricing.",
    aclPrincipals: ["group:legal"],
  },
];

async function seedDatabase() {
  const pgModule = await import("pg");
  const pg = pgModule.default ?? pgModule;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("DELETE FROM document_chunks WHERE id LIKE 'e2e-%'");
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

function startService(nimBaseUrl) {
  const child = spawn(process.execPath, ["--experimental-strip-types", "./src/index.ts"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      RETRIEVAL_API_BACKEND: "pgvector",
      RETRIEVAL_API_DATABASE_URL: databaseUrl,
      RETRIEVAL_API_HOST: "127.0.0.1",
      RETRIEVAL_API_PORT: "8091",
      EMBEDDING_ENDPOINT: nimBaseUrl,
      RERANK_ENDPOINT: nimBaseUrl,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return child;
}

async function waitForHealth(baseUrl, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // service not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("retrieval API did not become healthy in time");
}

async function query(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/v1/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`E2E assertion failed: ${message}`);
  }
}

const failures = [];
let mockNim;
let service;

try {
  mockNim = await startMockNim();
  const nimBaseUrl = `http://127.0.0.1:${mockNim.address().port}`;
  console.log(`mock NIM listening on ${nimBaseUrl}`);

  await seedDatabase();
  console.log(`seeded ${seedChunks.length} e2e chunks`);

  service = startService(nimBaseUrl);
  const baseUrl = "http://127.0.0.1:8091";
  await waitForHealth(baseUrl);
  console.log("retrieval API healthy in pgvector mode");

  const checks = [
    {
      name: "field-agent only grounds on sanitized collections",
      run: async () => {
        const { status, body } = await query(baseUrl, {
          query: "PostgreSQL storage",
          role: "field-agent",
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(body.groundingMode === "sanitized-only", "field-agent grounding mode");
        assert(body.results.length > 0, "field-agent should receive sanitized results");
        for (const result of body.results) {
          assert(
            ["enterprise-public", "enterprise-internal-sanitized"].includes(result.collection),
            `field-agent leaked collection ${result.collection}`,
          );
        }
      },
    },
    {
      name: "field-agent principals are ignored (cannot escalate)",
      run: async () => {
        const { body } = await query(baseUrl, {
          query: "bill of materials supplier pricing",
          role: "field-agent",
          collections: ["enterprise-sensitive"],
        });
        // enterprise-sensitive is denied for the role entirely.
        assert(body.error === "forbidden", "field-agent must be denied sensitive collections");
      },
    },
    {
      name: "vault-agent without principals sees only unrestricted chunks",
      run: async () => {
        const { body } = await query(baseUrl, {
          query: "bill of materials supplier pricing",
          role: "vault-agent",
        });
        const ids = body.results.map((result) => result.id);
        assert(!ids.includes("e2e-sensitive-bom"), "ACL chunk must be hidden without principals");
        assert(!ids.includes("e2e-regulated-contract"), "regulated chunk must be hidden");
      },
    },
    {
      name: "vault-agent with matching principal retrieves ACL chunk",
      run: async () => {
        const { body } = await query(baseUrl, {
          query: "bill of materials supplier pricing",
          role: "vault-agent",
          principals: ["group:supply-chain"],
        });
        const ids = body.results.map((result) => result.id);
        assert(ids.includes("e2e-sensitive-bom"), "matching principal must unlock ACL chunk");
        assert(!ids.includes("e2e-regulated-contract"), "non-matching principal must stay hidden");
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
  if (service) {
    service.kill("SIGTERM");
  }
  if (mockNim) {
    mockNim.close();
  }
}

if (failures.length > 0) {
  console.error(`E2E failed with ${failures.length} failure(s).`);
  process.exit(1);
}
console.log("E2E local stack validation passed.");
process.exit(0);
