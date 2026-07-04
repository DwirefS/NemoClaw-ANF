// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

export interface SqlQueryClient {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

interface AppliedMigrationRow {
  filename: string;
}

const MIGRATION_LEDGER_SQL = [
  "CREATE TABLE IF NOT EXISTS schema_migrations (",
  "  filename TEXT PRIMARY KEY,",
  "  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()",
  ")",
].join("\n");

export function listSqlMigrationFiles(sqlDirectory: string): string[] {
  return fs
    .readdirSync(sqlDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(sqlDirectory, file));
}

export async function applySqlMigrations(
  client: SqlQueryClient,
  sqlDirectory: string,
): Promise<void> {
  await client.query(MIGRATION_LEDGER_SQL);
  const applied = (await client.query("SELECT filename FROM schema_migrations")) as {
    rows?: AppliedMigrationRow[];
  };
  const appliedSet = new Set((applied.rows ?? []).map((row) => row.filename));

  for (const file of listSqlMigrationFiles(sqlDirectory)) {
    const filename = path.basename(file);
    if (appliedSet.has(filename)) {
      continue;
    }
    const sql = fs.readFileSync(file, "utf8");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
  }
}
