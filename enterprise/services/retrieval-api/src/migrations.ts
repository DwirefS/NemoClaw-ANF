// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

export interface SqlQueryClient {
  query(sql: string): Promise<unknown>;
}

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
  for (const file of listSqlMigrationFiles(sqlDirectory)) {
    const sql = fs.readFileSync(file, "utf8");
    await client.query(sql);
  }
}
