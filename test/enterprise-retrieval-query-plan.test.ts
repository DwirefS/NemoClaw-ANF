// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { buildHybridSearchPlan } from "../enterprise/services/retrieval-api/src/pgvector";

describe("enterprise retrieval pgvector query planning", () => {
  it("builds a field-agent plan with sanitized collection filtering", () => {
    const plan = buildHybridSearchPlan({
      query: "What changed in the last release?",
      role: "field-agent",
      collections: ["enterprise-public", "enterprise-sensitive"],
      maxResults: 99,
    });

    expect(plan.mode).toBe("hybrid-rrf");
    expect(plan.limit).toBe(12);
    expect(plan.policy.filteredCollections).toEqual(["enterprise-public"]);
    expect(plan.policy.deniedCollections).toEqual(["enterprise-sensitive"]);
    expect(plan.parameterOrder).toEqual(["queryEmbedding", "collections", "queryText", "limit", "rrfK"]);
    expect(plan.parameters.collections).toEqual(["enterprise-public"]);
    expect(plan.parameters.queryText).toBe("What changed in the last release?");
    expect(plan.sql).toContain("WITH vector_hits AS");
    expect(plan.sql).toContain("collection = ANY($2)");
    expect(plan.sql).toContain("plainto_tsquery('english', $3)");
    expect(plan.sql).toContain("1.0 / ($5 +");
  });

  it("builds a vault-agent plan that preserves restricted collection access", () => {
    const plan = buildHybridSearchPlan({
      query: "Summarize the Q4 forecast variance",
      role: "vault-agent",
      collections: ["enterprise-sensitive"],
      maxResults: 3,
    });

    expect(plan.limit).toBe(3);
    expect(plan.policy.filteredCollections).toEqual(["enterprise-sensitive"]);
    expect(plan.policy.deniedCollections).toEqual([]);
    expect(plan.parameters.collections).toEqual(["enterprise-sensitive"]);
    expect(plan.parameters.limit).toBe(3);
  });
});
