// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applySqlMigrations, listSqlMigrationFiles } from "../enterprise/services/retrieval-api/src/migrations";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("enterprise retrieval migrations", () => {
  it("lists SQL migration files in stable sorted order", () => {
    expect(listSqlMigrationFiles(path.join(repoRoot, "enterprise/services/retrieval-api/sql"))).toEqual([
      path.join(repoRoot, "enterprise/services/retrieval-api/sql/001_document_chunks.sql"),
    ]);
  });

  it("applies each SQL migration file to the provided query client", async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    });

    await applySqlMigrations(
      { query },
      path.join(repoRoot, "enterprise/services/retrieval-api/sql"),
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(queries[0]).toContain("CREATE TABLE IF NOT EXISTS document_chunks");
    expect(queries[0]).toContain("CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx");
  });

  it("exposes a runnable bootstrap entrypoint script in the retrieval package", () => {
    const bootstrapPath = path.join(
      repoRoot,
      "enterprise/services/retrieval-api/src/bootstrap.ts",
    );
    const bootstrap = fs.readFileSync(bootstrapPath, "utf8");

    expect(bootstrap).toContain("applySqlMigrations");
    expect(bootstrap).toContain("RETRIEVAL_API_DATABASE_URL");
  });
});
