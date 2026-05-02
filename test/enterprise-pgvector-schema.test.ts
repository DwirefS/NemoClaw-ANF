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
    expect(schema).toContain("embedding vector(3072)");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx");
    expect(schema).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS document_chunks_tsv_gin_idx");
    expect(schema).toContain("USING GIN (tsv)");
  });
});
