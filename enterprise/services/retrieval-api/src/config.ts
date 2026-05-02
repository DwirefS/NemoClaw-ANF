// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface RetrievalApiConfig {
  host: string;
  port: number;
  profileMode: "hybrid";
  serviceName: string;
}

export interface RetrievalBackendConfig {
  backend: "static" | "pgvector";
  databaseUrl?: string;
  embeddingEndpoint: string;
  rerankEndpoint: string;
  nimApiKey?: string;
}

export interface RetrievalRuntimeConfig extends RetrievalApiConfig, RetrievalBackendConfig {}

export function loadRetrievalApiConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalRuntimeConfig {
  const rawPort = Number(env.RETRIEVAL_API_PORT || "8080");
  return {
    host: env.RETRIEVAL_API_HOST || "0.0.0.0",
    port: Number.isFinite(rawPort) ? rawPort : 8080,
    profileMode: "hybrid",
    serviceName: env.RETRIEVAL_API_SERVICE_NAME || "retrieval-api",
    backend: env.RETRIEVAL_API_BACKEND === "pgvector" ? "pgvector" : "static",
    databaseUrl: env.RETRIEVAL_API_DATABASE_URL,
    embeddingEndpoint: env.EMBEDDING_ENDPOINT || "http://nemo-embedder.inference.svc.cluster.local:8000",
    rerankEndpoint: env.RERANK_ENDPOINT || "http://nemo-reranker.inference.svc.cluster.local:8000",
    nimApiKey: env.NIM_API_KEY,
  };
}
