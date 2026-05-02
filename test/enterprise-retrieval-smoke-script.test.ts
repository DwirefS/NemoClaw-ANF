// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retrieval smoke bootstrap script", () => {
  it("checks the required environment variables and prints a readiness summary", () => {
    const script = readFileSync(
      resolve(
        import.meta.dirname,
        "..",
        "enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs",
      ),
      "utf8",
    );

    expect(script).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(script).toContain("RETRIEVAL_API_EMBEDDING_URL");
    expect(script).toContain("RETRIEVAL_API_RERANKER_URL");
    expect(script).toContain("Embedding endpoint");
    expect(script).toContain("Reranker endpoint");
  });
});
