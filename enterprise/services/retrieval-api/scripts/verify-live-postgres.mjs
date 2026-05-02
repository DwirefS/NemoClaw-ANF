#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const pgModule = await import("pg");
const pg = pgModule.default ?? pgModule;
const { Client } = pg;

const client = new Client({ connectionString: databaseUrl });

const run = async () => {
  await client.connect();

  const extension = await client.query(
    "select extname from pg_extension where extname = 'vector'",
  );
  const table = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'document_chunks'",
  );
  const indexes = await client.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'document_chunks'
      and indexname in ('document_chunks_embedding_idx', 'document_chunks_fts_idx')
    order by indexname
  `);

  const extensionReady = extension.rowCount === 1;
  const tableReady = table.rowCount === 1;
  const presentIndexes = indexes.rows.map((row) => row.indexname);
  const expectedIndexes = [
    "document_chunks_embedding_idx",
    "document_chunks_fts_idx",
  ];
  const missingIndexes = expectedIndexes.filter(
    (name) => !presentIndexes.includes(name),
  );

  console.log("Verification summary");
  console.log(`vector extension: ${extensionReady ? "present" : "missing"}`);
  console.log(`document_chunks table: ${tableReady ? "present" : "missing"}`);
  console.log(`Indexes present: ${presentIndexes.join(", ") || "<none>"}`);

  if (!extensionReady || !tableReady || missingIndexes.length > 0) {
    console.error("Live PostgreSQL verification failed.");
    if (!extensionReady) {
      console.error("- vector extension is missing");
    }
    if (!tableReady) {
      console.error("- document_chunks table is missing");
    }
    for (const indexName of missingIndexes) {
      console.error(`- missing index: ${indexName}`);
    }
    process.exit(1);
  }

  console.log("Live PostgreSQL verification passed.");
};

try {
  await run();
} catch (error) {
  console.error("Live PostgreSQL verification failed with an unexpected error.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
