// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("enterprise pgvector schema", () => {
  it("defines the document chunk schema and hybrid-search indexes", () => {
    const schemaPath = path.join(
      repoRoot,
      "enterprise/services/retrieval-api/sql/001_document_chunks.sql",
    );
    const schema = fs.readFileSync(schemaPath, "utf8");

    expect(schema).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS document_chunks");
    // 1024 matches nvidia/nv-embedqa-e5-v5 and stays under the 2000-dimension
    // pgvector HNSW limit; 3072 previously made the index unbuildable.
    expect(schema).toContain("embedding vector(1024)");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx");
    expect(schema).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS document_chunks_tsv_gin_idx");
    expect(schema).toContain("USING GIN (tsv)");
  });

  it("captures ACL principals for permission-aware retrieval", () => {
    const aclPath = path.join(
      repoRoot,
      "enterprise/services/retrieval-api/sql/002_acl_principals.sql",
    );
    const acl = fs.readFileSync(aclPath, "utf8");

    expect(acl).toContain("ADD COLUMN IF NOT EXISTS acl_principals TEXT[] NOT NULL DEFAULT '{}'");
    expect(acl).toContain("document_chunks_acl_principals_gin_idx");
    expect(acl).toContain("USING GIN (acl_principals)");
  });
});
