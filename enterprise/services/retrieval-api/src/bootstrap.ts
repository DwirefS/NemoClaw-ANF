// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadRetrievalApiConfig } from "./config";
import { applySqlMigrations } from "./migrations";

async function main() {
  const config = loadRetrievalApiConfig();
  if (!config.databaseUrl) {
    throw new Error("RETRIEVAL_API_DATABASE_URL is required for retrieval bootstrap.");
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  const sqlDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../sql",
  );

  try {
    await applySqlMigrations(pool, sqlDirectory);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("retrieval-api bootstrap failed", error);
  process.exitCode = 1;
});
