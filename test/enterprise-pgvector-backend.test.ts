// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { createPgvectorBackend } from "../enterprise/services/retrieval-api/src/pgvector-backend";

describe("enterprise pgvector backend", () => {
  it("checks backend health with a lightweight SQL probe", async () => {
    const query = vi.fn(async () => ({ rows: [{ ready: 1 }] }));
    const backend = createPgvectorBackend({
      client: { query },
      embeddingProvider: {
        embedQuery: async () => [0.1, 0.2, 0.3],
      },
    });

    await expect(backend.health()).resolves.toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith("SELECT 1 AS ready", []);
  });

  it("executes the hybrid pgvector plan and maps rows into retrieval results", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: "chunk-1",
          content: "Restricted financial forecast",
          source_id: "forecast-q4",
          title: "Q4 Forecast",
          collection: "enterprise-sensitive",
          classification: "finance-sensitive",
          metadata: {
            section: "variance",
          },
          fused_score: 1.337,
        },
      ],
    }));
    const embedQuery = vi.fn(async () => [0.25, 0.5, 0.75]);
    const backend = createPgvectorBackend({
      client: { query },
      embeddingProvider: { embedQuery },
    });

    const results = await backend.search({
      query: "Summarize the Q4 forecast variance",
      role: "vault-agent",
      collections: ["enterprise-sensitive"],
      maxResults: 3,
    });

    expect(embedQuery).toHaveBeenCalledWith("Summarize the Q4 forecast variance");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("WITH vector_hits AS");
    expect(query.mock.calls[0]?.[1]).toEqual([
      [0.25, 0.5, 0.75],
      ["enterprise-sensitive"],
      "Summarize the Q4 forecast variance",
      3,
      60,
    ]);
    expect(results).toEqual([
      {
        id: "chunk-1",
        content: "Restricted financial forecast",
        sourceId: "forecast-q4",
        title: "Q4 Forecast",
        collection: "enterprise-sensitive",
        classification: "finance-sensitive",
        score: 1.337,
        metadata: {
          section: "variance",
        },
      },
    ]);
  });

  it("applies reranking results when a reranking provider is configured", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: "chunk-1",
          content: "First passage",
          source_id: "doc-1",
          title: "Doc One",
          collection: "enterprise-sensitive",
          classification: "finance-sensitive",
          metadata: {},
          fused_score: 0.8,
        },
        {
          id: "chunk-2",
          content: "Second passage",
          source_id: "doc-2",
          title: "Doc Two",
          collection: "enterprise-sensitive",
          classification: "finance-sensitive",
          metadata: {},
          fused_score: 0.6,
        },
      ],
    }));
    const rerank = vi.fn(async () => [
      { index: 1, score: 0.95 },
      { index: 0, score: 0.7 },
    ]);
    const backend = createPgvectorBackend({
      client: { query },
      embeddingProvider: {
        embedQuery: async () => [0.1, 0.2, 0.3],
      },
      rerankingProvider: { rerank },
    });

    const results = await backend.search({
      query: "Which passage is more relevant?",
      role: "vault-agent",
      collections: ["enterprise-sensitive"],
      maxResults: 2,
    });

    expect(rerank).toHaveBeenCalledWith("Which passage is more relevant?", [
      "First passage",
      "Second passage",
    ]);
    expect(results.map((result) => result.id)).toEqual(["chunk-2", "chunk-1"]);
    expect(results.map((result) => result.score)).toEqual([0.95, 0.7]);
  });
});
