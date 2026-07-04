// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retrieval live postgres verification script", () => {
  it("checks the pgvector extension and document_chunks contract", () => {
    const script = readFileSync(
      resolve(
        import.meta.dirname,
        "..",
        "enterprise/services/retrieval-api/scripts/verify-live-postgres.mjs",
      ),
      "utf8",
    );

    expect(script).toContain('"pg"');
    expect(script).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(script).toContain("pg_extension");
    expect(script).toContain("document_chunks");
    expect(script).toContain("document_chunks_embedding_hnsw_idx");
    expect(script).toContain("document_chunks_tsv_gin_idx");
    expect(script).toContain("document_chunks_acl_principals_gin_idx");
    expect(script).toContain("Verification summary");
    expect(script).toContain("process.exit(1)");
  });
});
