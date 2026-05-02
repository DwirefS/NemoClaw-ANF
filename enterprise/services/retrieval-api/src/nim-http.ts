// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_RERANKING_MODEL,
  buildEmbeddingNimRequest,
  buildRerankingNimRequest,
} from "./nvidia";

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
}

export interface EmbeddingProviderOptions extends FetchOptions {
  baseUrl: string;
  model?: string;
}

export interface RerankingProviderOptions extends FetchOptions {
  baseUrl: string;
  model?: string;
}

export interface QueryEmbeddingProvider {
  embedQuery(query: string): Promise<number[]>;
}

export interface RerankingResult {
  index: number;
  score: number;
}

export interface RerankingProvider {
  rerank(query: string, passages: string[]): Promise<RerankingResult[]>;
}

interface EmbeddingResponseBody {
  data?: Array<{
    embedding?: number[];
  }>;
}

interface RankingResponseBody {
  data?: Array<{
    index?: number;
    relevance_score?: number;
  }>;
}

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

async function postJson(
  url: string,
  payload: Record<string, unknown>,
  options: FetchOptions,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.apiKey) {
    headers.authorization = `Bearer ${options.apiKey}`;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`NIM request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

export function createNimEmbeddingProvider(
  options: EmbeddingProviderOptions,
): QueryEmbeddingProvider {
  return {
    async embedQuery(query: string) {
      const request = buildEmbeddingNimRequest(query);
      const response = await postJson(
        buildUrl(options.baseUrl, request.path),
        {
          ...request.payload,
          model: options.model ?? DEFAULT_EMBEDDING_MODEL,
        },
        options,
      );
      const body = (await response.json()) as EmbeddingResponseBody;
      const embedding = body.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        throw new Error("Embedding NIM response did not include an embedding vector.");
      }
      return embedding;
    },
  };
}

export function createNimRerankingProvider(
  options: RerankingProviderOptions,
): RerankingProvider {
  return {
    async rerank(query: string, passages: string[]) {
      const request = buildRerankingNimRequest(query, passages);
      const response = await postJson(
        buildUrl(options.baseUrl, request.path),
        {
          ...request.payload,
          model: options.model ?? DEFAULT_RERANKING_MODEL,
        },
        options,
      );
      const body = (await response.json()) as RankingResponseBody;
      return (body.data ?? []).map((item) => ({
        index: Number(item.index ?? 0),
        score: Number(item.relevance_score ?? 0),
      }));
    },
  };
}
