// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { BackendSearchRequest, RetrievalBackend } from "./backend";
import type { RetrievalResult } from "./contracts";
import { buildHybridSearchPlan } from "./pgvector";

interface PgvectorRow {
  id: string;
  content: string;
  source_id: string;
  title: string;
  collection: string;
  classification: string;
  metadata: Record<string, unknown> | null;
  fused_score: number | string | null;
}

export interface PgvectorQueryClient {
  query<TRow>(sql: string, parameters: unknown[]): Promise<{ rows: TRow[] }>;
}

export interface QueryEmbeddingProvider {
  embedQuery(query: string): Promise<number[]>;
}

export interface RerankingProvider {
  rerank(query: string, passages: string[]): Promise<Array<{ index: number; score: number }>>;
}

export interface CreatePgvectorBackendOptions {
  client: PgvectorQueryClient;
  embeddingProvider: QueryEmbeddingProvider;
  rerankingProvider?: RerankingProvider;
}

function toRetrievalResult(row: PgvectorRow): RetrievalResult {
  return {
    id: row.id,
    content: row.content,
    sourceId: row.source_id,
    title: row.title,
    collection: row.collection,
    classification: row.classification,
    score: Number(row.fused_score ?? 0),
    metadata: row.metadata ?? {},
  };
}

function applyReranking(
  rows: PgvectorRow[],
  reranked: Array<{ index: number; score: number }>,
): PgvectorRow[] {
  const scoreByIndex = new Map(reranked.map((item) => [item.index, item.score]));

  return rows
    .map((row, index) => ({
      row,
      index,
      score: scoreByIndex.get(index),
    }))
    .sort((left, right) => (right.score ?? Number.NEGATIVE_INFINITY) - (left.score ?? Number.NEGATIVE_INFINITY))
    .map((item) => ({
      ...item.row,
      fused_score: item.score ?? item.row.fused_score,
    }));
}

export function createPgvectorBackend(
  options: CreatePgvectorBackendOptions,
): RetrievalBackend {
  return {
    async health() {
      await options.client.query("SELECT 1 AS ready", []);
      return { ok: true };
    },
    async search(request: BackendSearchRequest) {
      const embedding = await options.embeddingProvider.embedQuery(request.query);
      const plan = buildHybridSearchPlan({
        query: request.query,
        role: request.role,
        collections: request.collections,
        maxResults: request.maxResults,
      });
      const result = await options.client.query<PgvectorRow>(plan.sql, [
        embedding,
        plan.parameters.collections,
        plan.parameters.queryText,
        plan.parameters.limit,
        plan.parameters.rrfK,
      ]);
      const rows =
        options.rerankingProvider && result.rows.length > 1
          ? applyReranking(
              result.rows,
              await options.rerankingProvider.rerank(
                request.query,
                result.rows.map((row) => row.content),
              ),
            )
          : result.rows;

      return rows.map(toRetrievalResult);
    },
  };
}
