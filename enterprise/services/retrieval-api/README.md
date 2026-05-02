<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Retrieval API

This service is the enterprise data-plane boundary between NemoClaw and the Azure ANF RAG stack.

Responsibilities:

- accept grounded retrieval requests from the worker-tier runtime
- enforce field-agent versus vault-agent retrieval policy
- keep direct PostgreSQL and raw ANF document access outside the agent runtime
- provide a stable service contract for deployment overlays

The current implementation supports two backend modes:

- `static`
  - in-memory backend for isolated contract testing
- `pgvector`
  - live PostgreSQL-oriented backend with embedding calls to a NIM endpoint

The service still keeps the same enterprise boundary even as backend mode changes.

Bootstrap support:

- `npm run bootstrap`
  - applies the SQL migration files in `sql/`
  - expects `RETRIEVAL_API_DATABASE_URL`

Current modules:

- `src/bootstrap.ts` applies the retrieval-store SQL migrations
- `src/server.ts` exposes `/healthz` and `/v1/query`
- `src/policy.ts` derives the retrieval boundary from the field and vault role model
- `src/pgvector.ts` emits a hybrid RRF query plan for a future live PostgreSQL executor
- `src/nvidia.ts` captures the request payload shapes for NVIDIA embedding, reranking, and Nemotron chat NIM endpoints
- `src/pgvector-backend.ts` executes the hybrid query plan through an injected PostgreSQL client and embedding provider
- `src/nim-http.ts` performs OpenAI-compatible HTTP calls to embedding and reranking NIM services
- `src/backend-factory.ts` selects either the static backend or the live `pgvector` backend from runtime config
- `src/migrations.ts` discovers and applies SQL migration files in stable order

Current live-backend behavior:

- query embeddings come from the configured embedding NIM
- PostgreSQL plus `pgvector` handles hybrid candidate retrieval
- the configured reranker NIM can reorder multi-result candidate sets before response packaging

Schema assets:

- `sql/001_document_chunks.sql` creates the `document_chunks` table, pgvector extension, HNSW index, and GIN full-text index used by the hybrid retrieval path
