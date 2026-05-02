// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { createNimEmbeddingProvider, createNimRerankingProvider } from "../enterprise/services/retrieval-api/src/nim-http";

describe("enterprise NIM HTTP clients", () => {
  it("calls the embedding NIM endpoint and returns the first embedding vector", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              embedding: [0.11, 0.22, 0.33],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const provider = createNimEmbeddingProvider({
      baseUrl: "http://nemo-embedder.inference.svc.cluster.local:8000",
      fetchImpl,
    });

    await expect(provider.embedQuery("What changed in the last release?")).resolves.toEqual([
      0.11,
      0.22,
      0.33,
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://nemo-embedder.inference.svc.cluster.local:8000/v1/embeddings",
    );
  });

  it("calls the reranking NIM endpoint and maps ranked passages", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { index: 1, relevance_score: 0.87 },
            { index: 0, relevance_score: 0.72 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const provider = createNimRerankingProvider({
      baseUrl: "http://nemo-reranker.inference.svc.cluster.local:8000",
      fetchImpl,
    });

    await expect(
      provider.rerank("Summarize the forecast variance", ["Passage one", "Passage two"]),
    ).resolves.toEqual([
      { index: 1, score: 0.87 },
      { index: 0, score: 0.72 },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://nemo-reranker.inference.svc.cluster.local:8000/v1/ranking",
    );
  });
});
