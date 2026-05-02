// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createStaticBackend, type RetrievalBackend } from "./backend";
import type { RetrievalBackendConfig } from "./config";
import { createNimEmbeddingProvider, createNimRerankingProvider } from "./nim-http";
import { createPgvectorBackend, type PgvectorQueryClient } from "./pgvector-backend";

export interface PgPoolModule {
  Pool: new (config: { connectionString: string }) => PgvectorQueryClient;
}

export interface CreateBackendFactoryOptions {
  fetchImpl?: typeof fetch;
  loadPgModule?: () => Promise<PgPoolModule>;
}

async function loadDefaultPgModule(): Promise<PgPoolModule> {
  return (await import("pg")) as unknown as PgPoolModule;
}

export async function createRetrievalBackendFromConfig(
  config: RetrievalBackendConfig,
  options: CreateBackendFactoryOptions = {},
): Promise<RetrievalBackend> {
  if (config.backend === "static") {
    return createStaticBackend([]);
  }

  if (!config.databaseUrl) {
    throw new Error("RETRIEVAL_API_DATABASE_URL is required when backend mode is pgvector.");
  }

  const pgModule = await (options.loadPgModule ?? loadDefaultPgModule)();
  const pool = new pgModule.Pool({
    connectionString: config.databaseUrl,
  });

  return createPgvectorBackend({
    client: pool,
    embeddingProvider: createNimEmbeddingProvider({
      baseUrl: config.embeddingEndpoint,
      fetchImpl: options.fetchImpl,
      apiKey: config.nimApiKey,
    }),
    rerankingProvider: createNimRerankingProvider({
      baseUrl: config.rerankEndpoint,
      fetchImpl: options.fetchImpl,
      apiKey: config.nimApiKey,
    }),
  });
}
