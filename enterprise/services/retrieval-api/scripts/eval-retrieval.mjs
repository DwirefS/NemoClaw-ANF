#!/usr/bin/env node

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Retrieval quality harness: seeds a labeled corpus, runs a query set with
// known relevant chunks through the live service, and reports recall@5 and
// MRR with pass/fail gates. This is the repeatable measurement the
// benchmarking runbook calls for — run it before and after any change to
// the planner, schema, embedding model, or index strategy.
//
// Required environment: RETRIEVAL_API_DATABASE_URL (bootstrapped schema).
// Usage: node ./scripts/eval-retrieval.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const RECALL_AT_5_GATE = 0.8;
const MRR_GATE = 0.5;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

// Labeled corpus: every doc is unrestricted so the eval isolates ranking
// quality from policy filtering (policy is covered by the e2e suites).
const corpus = [
  [
    "eval-anf-tiers",
    "ANF service levels",
    "Azure NetApp Files offers Standard, Premium, and Ultra service levels with different throughput per terabyte.",
  ],
  [
    "eval-anf-snapshots",
    "ANF snapshots",
    "Azure NetApp Files snapshots are instantaneous, space efficient, and enable fast restore of volumes.",
  ],
  [
    "eval-pg-wal",
    "PostgreSQL WAL tuning",
    "Placing the PostgreSQL write ahead log on a dedicated Ultra volume isolates commit latency from data file IO.",
  ],
  [
    "eval-pgvector-hnsw",
    "pgvector HNSW",
    "The pgvector extension builds HNSW graph indexes for approximate nearest neighbor search over embeddings.",
  ],
  [
    "eval-nim-cache",
    "NIM model cache",
    "NIMCache resources download model engines once onto shared storage so NIMService replicas start quickly.",
  ],
  [
    "eval-nemotron",
    "Nemotron serving",
    "The Nemotron language model is served through an OpenAI compatible chat completions endpoint on the NIM.",
  ],
  [
    "eval-ingest",
    "NeMo Retriever ingestion",
    "NeMo Retriever extracts, chunks, and embeds documents before writing them into the retrieval store.",
  ],
  [
    "eval-gateway-audit",
    "Gateway audit trail",
    "The secure gateway writes an audit event with a query hash for every allow and deny decision.",
  ],
  [
    "eval-worker-tier",
    "Worker tier",
    "NemoClaw agents run on an isolated worker tier and reach knowledge only through the retrieval API.",
  ],
  [
    "eval-trident",
    "Trident CSI",
    "The Trident CSI driver provisions Azure NetApp Files volumes for Kubernetes persistent volume claims.",
  ],
];

const queries = [
  ["Which ANF service levels exist and how do they differ?", "eval-anf-tiers"],
  ["How do I restore a volume quickly from a snapshot?", "eval-anf-snapshots"],
  ["Where should the write ahead log live for low commit latency?", "eval-pg-wal"],
  ["What index does pgvector use for nearest neighbor search?", "eval-pgvector-hnsw"],
  ["Why do NIMService replicas start quickly after the first download?", "eval-nim-cache"],
  ["What endpoint shape does the Nemotron model expose?", "eval-nemotron"],
  ["What extracts and chunks documents before embedding?", "eval-ingest"],
  ["What records every allow and deny decision?", "eval-gateway-audit"],
  ["How do agents reach enterprise knowledge?", "eval-worker-tier"],
  ["What provisions ANF volumes for Kubernetes claims?", "eval-trident"],
];

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
      const queryTokens = new Set(
        String(body.query?.text ?? "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean),
      );
      response.end(
        JSON.stringify({
          data: passages
            .map((passage, index) => {
              const tokens = String(passage?.text ?? "")
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter(Boolean);
              const hits = tokens.filter((token) => queryTokens.has(token)).length;
              return { index, relevance_score: tokens.length === 0 ? 0 : hits / tokens.length };
            })
            .sort((left, right) => right.relevance_score - left.relevance_score),
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

async function seedCorpus() {
  const pgModule = await import("pg");
  const pg = pgModule.default ?? pgModule;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("DELETE FROM document_chunks WHERE id LIKE 'eval-%'");
    for (const [id, title, content] of corpus) {
      await client.query(
        `INSERT INTO document_chunks
           (id, source_id, title, collection, classification, content, metadata, embedding, acl_principals)
         VALUES ($1, $2, $3, 'enterprise-public', 'public', $4, '{}'::jsonb, $5::vector, '{}')`,
        [id, `${id}.md`, title, content, JSON.stringify(pseudoEmbed(`${title} ${content}`))],
      );
    }
  } finally {
    await client.end();
  }
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
  throw new Error("retrieval API did not become healthy in time");
}

let mockNim;
let service;
let exitCode = 0;

try {
  mockNim = await startMockNim();
  const nimBaseUrl = `http://127.0.0.1:${mockNim.address().port}`;
  await seedCorpus();

  service = spawn(process.execPath, ["--experimental-strip-types", "./src/index.ts"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      RETRIEVAL_API_BACKEND: "pgvector",
      RETRIEVAL_API_DATABASE_URL: databaseUrl,
      RETRIEVAL_API_HOST: "127.0.0.1",
      RETRIEVAL_API_PORT: "8098",
      EMBEDDING_ENDPOINT: nimBaseUrl,
      RERANK_ENDPOINT: nimBaseUrl,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const baseUrl = "http://127.0.0.1:8098";
  await waitForHealth(baseUrl);

  let recallHits = 0;
  let reciprocalRankSum = 0;
  const rows = [];

  for (const [query, expectedId] of queries) {
    const response = await fetch(`${baseUrl}/v1/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, role: "field-agent", maxResults: 5 }),
    });
    const payload = await response.json();
    const rankedIds = (payload.results ?? []).map((result) => result.id);
    const rank = rankedIds.indexOf(expectedId) + 1;
    if (rank >= 1 && rank <= 5) {
      recallHits += 1;
    }
    reciprocalRankSum += rank >= 1 ? 1 / rank : 0;
    rows.push({ query, expectedId, rank: rank >= 1 ? rank : "miss" });
  }

  const recallAt5 = recallHits / queries.length;
  const mrr = reciprocalRankSum / queries.length;

  console.log("\nRetrieval quality report");
  console.log("------------------------");
  for (const row of rows) {
    console.log(`rank ${String(row.rank).padStart(4)}  ${row.expectedId.padEnd(22)} ${row.query}`);
  }
  console.log("------------------------");
  console.log(`recall@5 ${recallAt5.toFixed(2)} (gate ${RECALL_AT_5_GATE})`);
  console.log(`MRR      ${mrr.toFixed(2)} (gate ${MRR_GATE})`);

  if (recallAt5 < RECALL_AT_5_GATE || mrr < MRR_GATE) {
    console.error("Retrieval quality gates FAILED.");
    exitCode = 1;
  } else {
    console.log("Retrieval quality gates passed.");
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (service) {
    service.kill("SIGTERM");
  }
  if (mockNim) {
    mockNim.close();
  }
}

process.exit(exitCode);
