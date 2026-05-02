// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { createRetrievalBackendFromConfig } from "../enterprise/services/retrieval-api/src/backend-factory";
import { loadRetrievalApiConfig } from "../enterprise/services/retrieval-api/src/config";

describe("enterprise retrieval bootstrap", () => {
  it("loads pgvector backend configuration and NIM endpoints from env", () => {
    const config = loadRetrievalApiConfig({
      RETRIEVAL_API_BACKEND: "pgvector",
      RETRIEVAL_API_DATABASE_URL: "postgres://retrieval:secret@postgres-pgvector.database.svc.cluster.local:5432/nemoclaw_rag",
      EMBEDDING_ENDPOINT: "http://nemo-embedder.inference.svc.cluster.local:8000",
      RERANK_ENDPOINT: "http://nemo-reranker.inference.svc.cluster.local:8000",
      RETRIEVAL_API_HOST: "127.0.0.1",
      RETRIEVAL_API_PORT: "8181",
      RETRIEVAL_API_SERVICE_NAME: "retrieval-api-live",
    });

    expect(config.backend).toBe("pgvector");
    expect(config.databaseUrl).toBe(
      "postgres://retrieval:secret@postgres-pgvector.database.svc.cluster.local:5432/nemoclaw_rag",
    );
    expect(config.embeddingEndpoint).toBe("http://nemo-embedder.inference.svc.cluster.local:8000");
    expect(config.rerankEndpoint).toBe("http://nemo-reranker.inference.svc.cluster.local:8000");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8181);
    expect(config.serviceName).toBe("retrieval-api-live");
  });

  it("creates a static backend without loading live integration dependencies", async () => {
    const loadPgModule = vi.fn(async () => {
      throw new Error("pg should not load in static mode");
    });
    const backend = await createRetrievalBackendFromConfig(
      {
        host: "0.0.0.0",
        port: 8080,
        profileMode: "hybrid",
        serviceName: "retrieval-api",
        backend: "static",
        embeddingEndpoint: "http://nemo-embedder.inference.svc.cluster.local:8000",
        rerankEndpoint: "http://nemo-reranker.inference.svc.cluster.local:8000",
      },
      {
        loadPgModule,
      },
    );

    await expect(backend.health()).resolves.toEqual({ ok: true });
    expect(loadPgModule).not.toHaveBeenCalled();
  });

  it("creates a pgvector backend with a live pg module and NIM embedding provider", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: "chunk-1",
          content: "Restricted financial forecast",
          source_id: "forecast-q4",
          title: "Q4 Forecast",
          collection: "enterprise-sensitive",
          classification: "finance-sensitive",
          metadata: { section: "variance" },
          fused_score: 1.2,
        },
      ],
    }));
    class FakePool {
      constructor(_config: { connectionString: string }) {}

      async query(sql: string, params: unknown[]) {
        return query(sql, params);
      }
    }
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ embedding: [0.5, 0.25, 0.75] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const backend = await createRetrievalBackendFromConfig(
      {
        host: "0.0.0.0",
        port: 8080,
        profileMode: "hybrid",
        serviceName: "retrieval-api",
        backend: "pgvector",
        databaseUrl: "postgres://retrieval:secret@postgres-pgvector.database.svc.cluster.local:5432/nemoclaw_rag",
        embeddingEndpoint: "http://nemo-embedder.inference.svc.cluster.local:8000",
        rerankEndpoint: "http://nemo-reranker.inference.svc.cluster.local:8000",
      },
      {
        fetchImpl,
        loadPgModule: async () => ({ Pool: FakePool }),
      },
    );

    const results = await backend.search({
      query: "Summarize the Q4 forecast variance",
      role: "vault-agent",
      collections: ["enterprise-sensitive"],
      maxResults: 3,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(results[0]?.id).toBe("chunk-1");
  });
});
