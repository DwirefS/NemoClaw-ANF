// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { RetrievalRequestBody } from "./contracts.ts";
import { resolveRetrievalPolicy } from "./policy.ts";

export interface HybridSearchPlan {
  mode: "hybrid-rrf";
  limit: number;
  parameterOrder: ["queryEmbedding", "collections", "queryText", "limit", "rrfK", "principals"];
  parameters: {
    collections: string[];
    queryText: string;
    limit: number;
    rrfK: number;
    principals: string[];
  };
  policy: ReturnType<typeof resolveRetrievalPolicy>["summary"];
  sql: string;
}

/**
 * Serializes a query embedding into the pgvector text literal form.
 * node-postgres encodes JS arrays as PostgreSQL array literals ("{...}"),
 * which the vector type rejects, so the embedding must travel as "[...]".
 */
export function toVectorLiteral(embedding: number[]): string {
  return JSON.stringify(embedding);
}

// Chunks are eligible when they are unrestricted (empty ACL) or when at
// least one chunk principal overlaps the request principals.
const ACL_PREDICATE = "(acl_principals = '{}' OR acl_principals && $6)";

export function buildHybridSearchPlan(request: RetrievalRequestBody): HybridSearchPlan {
  const policy = resolveRetrievalPolicy(request);
  const rrfK = 60;

  return {
    mode: "hybrid-rrf",
    limit: policy.maxResults,
    parameterOrder: ["queryEmbedding", "collections", "queryText", "limit", "rrfK", "principals"],
    parameters: {
      collections: policy.filteredCollections,
      queryText: request.query,
      limit: policy.maxResults,
      rrfK,
      principals: policy.principals,
    },
    policy: policy.summary,
    sql: [
      "WITH vector_hits AS (",
      "  SELECT id, content, source_id, title, collection, classification, metadata,",
      "         ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS vector_rank",
      "  FROM document_chunks",
      "  WHERE collection = ANY($2)",
      `    AND ${ACL_PREDICATE}`,
      "  ORDER BY embedding <=> $1::vector",
      "  LIMIT $4",
      "),",
      "fts_hits AS (",
      "  SELECT id, content, source_id, title, collection, classification, metadata,",
      "         ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, plainto_tsquery('english', $3)) DESC) AS fts_rank",
      "  FROM document_chunks",
      "  WHERE collection = ANY($2)",
      `    AND ${ACL_PREDICATE}`,
      "    AND tsv @@ plainto_tsquery('english', $3)",
      "  ORDER BY ts_rank_cd(tsv, plainto_tsquery('english', $3)) DESC",
      "  LIMIT $4",
      ")",
      "SELECT COALESCE(v.id, f.id) AS id,",
      "       COALESCE(v.content, f.content) AS content,",
      "       COALESCE(v.source_id, f.source_id) AS source_id,",
      "       COALESCE(v.title, f.title) AS title,",
      "       COALESCE(v.collection, f.collection) AS collection,",
      "       COALESCE(v.classification, f.classification) AS classification,",
      "       COALESCE(v.metadata, f.metadata) AS metadata,",
      "       COALESCE(1.0 / ($5 + v.vector_rank), 0) + COALESCE(1.0 / ($5 + f.fts_rank), 0) AS fused_score",
      "FROM vector_hits v",
      "FULL OUTER JOIN fts_hits f ON v.id = f.id",
      "ORDER BY fused_score DESC",
      "LIMIT $4",
    ].join("\n"),
  };
}
