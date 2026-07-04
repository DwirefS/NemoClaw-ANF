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

## Database Bootstrap

Run the bootstrap job before the retrieval API deployment points at a fresh PostgreSQL instance.

The bootstrap flow applies the SQL files under `sql/` through the package-owned migration runner:

```bash
npm run bootstrap
```

## Live PostgreSQL Verification

Use the package-owned verification script after bootstrap completes and before enabling live retrieval against a newly provisioned or changed PostgreSQL instance.

```bash
npm run verify:postgres
```

The verification checks:

- the `vector` extension
- the `document_chunks` table
- the expected embedding, full-text, and ACL indexes

## End-To-End Local Stack Validation

The package ships a full end-to-end validation that seeds a sample corpus, mocks the embedding and reranking NIM contracts locally, boots the service in `pgvector` mode, and asserts role and ACL enforcement through the HTTP surface:

```bash
npm run e2e:local
```

It requires a bootstrapped `RETRIEVAL_API_DATABASE_URL` and is also run in CI against a `pgvector/pgvector` service container by `.github/workflows/enterprise-retrieval-e2e.yaml`.

## ACL-Aware Retrieval

Chunks carry an `acl_principals` array (`sql/002_acl_principals.sql`):

- an empty array marks the chunk unrestricted (sanitized or public corpus)
- a non-empty array requires at least one matching principal on the request

Requests may carry `principals` (user, group, or service identifiers). Policy resolution strips principals from `field-agent` requests, so sanitized-only roles can never reach ACL-restricted chunks regardless of what they send. Identity-provider mapping (who is allowed to assert which principals) is intentionally still upstream of this service and tracked as open work in the incubator.

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
- `sql/002_acl_principals.sql` adds the `acl_principals` column and GIN index for permission-aware retrieval
- migrations are recorded in a `schema_migrations` ledger so re-running bootstrap only applies pending files

The embedding column is `vector(1024)`, matching the default embedding model (`nvidia/nv-embedqa-e5-v5`). Changing the embedding model requires a coordinated migration: pgvector HNSW indexes reject `vector` columns above 2000 dimensions, so larger models need a `halfvec` index strategy on pgvector 0.7+.

## Agent Memory

Composable memory tiers per the whitepaper vision:

| Tier | Store | Recall |
|---|---|---|
| Semantic | `agent_memory` rows with pgvector embeddings | hybrid vector + full-text, RRF-fused |
| Episodic | `agent_memory` rows without embeddings | full-text rank and recency |
| State | ANF volume snapshots of the agent workspace | see the disaster-recovery runbook |

Endpoints (pgvector mode only; 404 otherwise):

- `POST /v1/memory` — `{agentId, kind: episodic|semantic, content, metadata?}` → 201 `{id}`; ids are content-addressed so re-remembering upserts
- `POST /v1/memory/recall` — `{agentId, query?, kind?, limit?}` → agent-scoped results

Memory is strictly identity-scoped: every SQL path filters `agent_id` first, and the secure gateway overwrites `agentId` with the verified subject, so one agent can never read or write another agent's memory. The retrieval API trusts the field only because the NetworkPolicy makes the gateway its sole caller.
