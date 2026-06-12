<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Data Plane: RAG And pgvector

This spec covers the AKS-hosted retrieval and ingestion plane. PostgreSQL with `pgvector` is an explicit product choice locked by ADR-003, not an NVIDIA stock RAG default — the overlay owns the schema, indexing, ingestion writes, and retrieval logic.

## Retrieval Store Schema

`enterprise/services/retrieval-api/sql/001_document_chunks.sql` defines the store:

- `document_chunks` table with `id`, `source_id`, `title`, `collection`, `classification`, `content`, `metadata JSONB`, `embedding vector(3072)`, and a stored generated `tsv tsvector` over title plus content,
- an HNSW index with `vector_cosine_ops`,
- a GIN index on `tsv`,
- a btree index on `collection`.

> **2026-06 currency note:** `pgvector` HNSW indexes cap at 2000 dimensions for the `vector` type, so the original 3072-dimension schema could not actually be indexed with HNSW as written. This mismatch is being fixed in the overlay (dimension reduction or `halfvec`). Treat the 3072-dim HNSW combination as a known defect, not a validated design.

## Hybrid Retrieval

`enterprise/services/retrieval-api/src/pgvector.ts` emits a hybrid RRF plan:

- a vector CTE ranked by `embedding <=> $1` (cosine distance),
- a full-text CTE ranked by `ts_rank_cd` over `plainto_tsquery('english', ...)`,
- a `FULL OUTER JOIN` fused with reciprocal rank fusion using `rrfK = 60`,
- collection filtering pushed into both CTEs via `collection = ANY($2)`.

`src/pgvector-backend.ts` executes the plan through an injected PostgreSQL client and embedding provider, with optional reranking-aware ordering of multi-result candidate sets.

## NIM Contracts

`enterprise/services/retrieval-api/src/nvidia.ts` encodes the request payload shapes:

| Purpose | Default Model | Path |
|---|---|---|
| Query embedding | `nvidia/nv-embedqa-e5-v5` | `/v1/embeddings` (`input_type: query`) |
| Reranking | `nvidia/llama-nemotron-rerank-1b-v2` | `/v1/ranking` |
| Chat | `nvidia/llama-3.1-nemotron-70b-instruct` | `/v1/chat/completions` |

`src/nim-http.ts` performs the OpenAI-compatible HTTP calls. These contracts are `validated` against mocked responses; live NIM validation is `next` in the backlog.

## Backend Modes

`src/config.ts` and `src/backend-factory.ts` select between:

- `static` — in-memory backend for isolated contract testing,
- `pgvector` — live backend using `RETRIEVAL_API_DATABASE_URL`, `EMBEDDING_ENDPOINT`, and `RERANK_ENDPOINT`.

The enterprise boundary (role policy, collection filtering, result limits) is identical in both modes.

## Ingestion Path

`enterprise/workers/nemo-retriever-ingest/` is the project-owned ingestion worker:

- reads documents from the mounted ANF repository (`INGEST_SOURCE_DIR`),
- uses the documented NeMo Retriever chain `create_ingestor().files(...).extract(endpoint=...).embed()` (pinned to `release/26.03` per the manifest provenance comments),
- normalizes chunks conservatively and writes `document_chunks` rows via `postgres_writer.py` with default collection `enterprise-public` and classification `internal-sanitized`.

The CronJob trigger is `incubator/enterprise-azure-anf/manifests/nv-ingest-trigger.yaml`. Live validation against real Retriever output shapes is `next`; duplicate-ingestion protection is `later`.

## Bootstrap And Verification

| Surface | Repo Asset |
|---|---|
| Migration discovery and bootstrap runner | `src/migrations.ts`, `src/bootstrap.ts`, `npm run bootstrap` |
| Deployment-time bootstrap job | `manifests/retrieval-bootstrap-job.yaml` |
| Env-contract smoke check (no DB touch) | `scripts/smoke-bootstrap.mjs` |
| Live PostgreSQL verification (extension, table, indexes) | `scripts/verify-live-postgres.mjs`, `npm run verify:postgres`, `manifests/retrieval-postgres-verify-job.yaml` |

The full flow is implemented end to end but `assumed` until exercised against a real cluster database.

## Status Summary

| Item | Status |
|---|---|
| Retrieval API boundary and contracts | `validated` |
| Hybrid dense plus sparse retrieval logic | `custom-build-required` |
| Live PostgreSQL bootstrap from service config | `assumed` |
| Live embedding and reranker NIM integration | `assumed` |
| Ingestion worker against live data | `assumed` |
| ACL-aware retrieval filtering | `blocked` (see spec 11) |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
