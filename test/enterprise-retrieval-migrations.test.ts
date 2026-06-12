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
      path.join(repoRoot, "enterprise/services/retrieval-api/sql/002_acl_principals.sql"),
    ]);
  });

  it("applies each pending SQL migration and records it in the ledger", async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    });

    await applySqlMigrations(
      { query },
      path.join(repoRoot, "enterprise/services/retrieval-api/sql"),
    );

    expect(queries[0]).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
    expect(queries[1]).toContain("SELECT filename FROM schema_migrations");
    expect(queries[2]).toContain("CREATE TABLE IF NOT EXISTS document_chunks");
    expect(queries[2]).toContain("CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx");
    expect(queries[3]).toContain("INSERT INTO schema_migrations");
    expect(queries[4]).toContain("acl_principals");
    expect(queries[5]).toContain("INSERT INTO schema_migrations");
  });

  it("skips migrations that are already recorded in the ledger", async () => {
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes("SELECT filename FROM schema_migrations")) {
        return { rows: [{ filename: "001_document_chunks.sql" }] };
      }
      return { rows: [] };
    });

    await applySqlMigrations(
      { query },
      path.join(repoRoot, "enterprise/services/retrieval-api/sql"),
    );

    const applied = queries.filter((sql) => sql.includes("CREATE TABLE IF NOT EXISTS document_chunks"));
    expect(applied).toHaveLength(0);
    const aclApplied = queries.filter((sql) => sql.includes("acl_principals TEXT[]"));
    expect(aclApplied).toHaveLength(1);
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
