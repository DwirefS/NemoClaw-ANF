#!/usr/bin/env node

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Live end-to-end validation of the secure gateway in front of the real
// retrieval stack: authentication (401/invalid token), role enforcement
// (403), identity-derived principals unlocking ACL chunks, redaction of
// sanitized-only content, audit-trail emission, and rate limiting.
//
// Required environment: RETRIEVAL_API_DATABASE_URL (bootstrapped schema).
// Usage: node ./scripts/e2e-gateway.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const gatewayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retrievalRoot = path.resolve(gatewayRoot, "..", "retrieval-api");
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
    response.statusCode = 404;
    response.end("{}");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function seedDatabase() {
  const requireFromRetrieval = createRequire(path.join(retrievalRoot, "package.json"));
  const pg = requireFromRetrieval("pg");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const seedChunks = [
    {
      id: "gw-e2e-public-contact",
      sourceId: "contact-list.md",
      title: "Public storage support contacts",
      collection: "enterprise-public",
      classification: "public",
      content:
        "For Azure NetApp Files storage support contact ops-team@example.com or +1 (555) 123-4567.",
      aclPrincipals: [],
    },
    {
      id: "gw-e2e-sensitive-bom",
      sourceId: "bom-q2.xlsx",
      title: "Quarterly bill of materials",
      collection: "enterprise-sensitive",
      classification: "sensitive",
      content: "The quarterly bill of materials lists supplier pricing for storage controllers.",
      aclPrincipals: ["group:supply-chain"],
    },
  ];
  try {
    await client.query("DELETE FROM document_chunks WHERE id LIKE 'gw-e2e-%'");
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

async function gatewayQuery(baseUrl, token, payload) {
  const headers = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}/v1/query`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Gateway E2E assertion failed: ${message}`);
  }
}

const FIELD_TOKEN = "e2e-field-token";
const VAULT_TOKEN = "e2e-vault-token";
const staticTokens = JSON.stringify({
  [FIELD_TOKEN]: {
    subject: "svc:field-console",
    allowedRoles: ["field-agent"],
    principals: [],
  },
  [VAULT_TOKEN]: {
    subject: "user:alice",
    allowedRoles: ["field-agent", "vault-agent"],
    principals: ["group:supply-chain"],
  },
});

const failures = [];
let mockNim;
let retrieval;
let gateway;
const auditPath = path.join(os.tmpdir(), `gateway-audit-${process.pid}.jsonl`);

try {
  mockNim = await startMockNim();
  const nimBaseUrl = `http://127.0.0.1:${mockNim.address().port}`;
  await seedDatabase();

  retrieval = startProcess(retrievalRoot, {
    RETRIEVAL_API_BACKEND: "pgvector",
    RETRIEVAL_API_DATABASE_URL: databaseUrl,
    RETRIEVAL_API_HOST: "127.0.0.1",
    RETRIEVAL_API_PORT: "8096",
    EMBEDDING_ENDPOINT: nimBaseUrl,
    RERANK_ENDPOINT: nimBaseUrl,
  });
  await waitForHealth("http://127.0.0.1:8096");

  gateway = startProcess(gatewayRoot, {
    GATEWAY_HOST: "127.0.0.1",
    GATEWAY_PORT: "8097",
    RETRIEVAL_API_URL: "http://127.0.0.1:8096",
    GATEWAY_AUTH_MODE: "static",
    GATEWAY_STATIC_TOKENS: staticTokens,
    GATEWAY_RATE_LIMIT_PER_MINUTE: "5",
    GATEWAY_AUDIT_LOG_PATH: auditPath,
  });
  const gatewayUrl = "http://127.0.0.1:8097";
  await waitForHealth(gatewayUrl);
  console.log("gateway healthy in front of live retrieval stack");

  const checks = [
    {
      name: "requests without a bearer token are rejected",
      run: async () => {
        const { status } = await gatewayQuery(gatewayUrl, "", {
          query: "storage",
          role: "field-agent",
        });
        assert(status === 401, `expected 401, got ${status}`);
      },
    },
    {
      name: "unknown tokens are rejected",
      run: async () => {
        const { status } = await gatewayQuery(gatewayUrl, "not-a-real-token", {
          query: "storage",
          role: "field-agent",
        });
        assert(status === 401, `expected 401, got ${status}`);
      },
    },
    {
      name: "identities cannot assume roles they were not granted",
      run: async () => {
        const { status, body } = await gatewayQuery(gatewayUrl, FIELD_TOKEN, {
          query: "bill of materials",
          role: "vault-agent",
        });
        assert(status === 403, `expected 403, got ${status}`);
        assert(body.error === "role_not_permitted", "expected role_not_permitted");
      },
    },
    {
      name: "sanitized responses are redacted (emails and phone numbers masked)",
      run: async () => {
        const { status, body } = await gatewayQuery(gatewayUrl, FIELD_TOKEN, {
          query: "storage support contact",
          role: "field-agent",
        });
        assert(status === 200, `expected 200, got ${status}`);
        const combined = body.results.map((result) => result.content).join(" ");
        assert(!combined.includes("ops-team@example.com"), "email leaked through redaction");
        assert(combined.includes("[redacted-email]"), "email mask missing");
        assert(combined.includes("[redacted-phone]"), "phone mask missing");
      },
    },
    {
      name: "identity-derived principals unlock ACL chunks (no principals in body)",
      run: async () => {
        const { status, body } = await gatewayQuery(gatewayUrl, VAULT_TOKEN, {
          query: "bill of materials supplier pricing",
          role: "vault-agent",
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(
          body.results.some((result) => result.id === "gw-e2e-sensitive-bom"),
          "identity principals did not unlock the ACL chunk",
        );
      },
    },
    {
      name: "body-supplied principals are ignored (cannot self-escalate)",
      run: async () => {
        const { status, body } = await gatewayQuery(gatewayUrl, FIELD_TOKEN, {
          query: "bill of materials supplier pricing",
          role: "field-agent",
          principals: ["group:supply-chain"],
        });
        assert(status === 200, `expected 200, got ${status}`);
        assert(
          !body.results.some((result) => result.id === "gw-e2e-sensitive-bom"),
          "body principals escalated access",
        );
      },
    },
    {
      name: "rate limiting trips after the configured budget",
      run: async () => {
        let limited = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const { status } = await gatewayQuery(gatewayUrl, VAULT_TOKEN, {
            query: "storage",
            role: "field-agent",
          });
          if (status === 429) {
            limited = true;
            break;
          }
        }
        assert(limited, "rate limit never tripped");
      },
    },
    {
      name: "audit trail records allow and deny decisions",
      run: async () => {
        const lines = fs
          .readFileSync(auditPath, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert(lines.length >= 5, `expected at least 5 audit events, got ${lines.length}`);
        assert(
          lines.some((event) => event.decision === "deny" && event.reason === "invalid_token"),
          "missing deny audit event",
        );
        const allow = lines.find(
          (event) => event.decision === "allow" && event.subject === "user:alice",
        );
        assert(allow, "missing allow audit event for user:alice");
        assert(
          typeof allow.queryHash === "string" && allow.queryHash.length === 32,
          "audit event should carry a query hash, not the raw query",
        );
        assert(
          !JSON.stringify(allow).includes("bill of materials"),
          "raw query text leaked into the audit trail",
        );
      },
    },
    {
      name: "metrics endpoint exposes request and redaction counters",
      run: async () => {
        const response = await fetch(`${gatewayUrl}/metrics`);
        const text = await response.text();
        assert(response.status === 200, `expected 200, got ${response.status}`);
        assert(text.includes("gateway_requests_total"), "requests counter missing");
        assert(text.includes("gateway_denied_total"), "denied counter missing");
        assert(text.includes("gateway_redactions_total"), "redactions counter missing");
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
  if (gateway) {
    gateway.kill("SIGTERM");
  }
  if (retrieval) {
    retrieval.kill("SIGTERM");
  }
  if (mockNim) {
    mockNim.close();
  }
  fs.rmSync(auditPath, { force: true });
}

if (failures.length > 0) {
  console.error(`Gateway E2E failed with ${failures.length} failure(s).`);
  process.exit(1);
}
console.log("Gateway E2E validation passed.");
process.exit(0);
