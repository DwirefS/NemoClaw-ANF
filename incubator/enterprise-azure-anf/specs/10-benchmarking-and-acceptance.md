<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Benchmarking And Acceptance

ADR-003 makes benchmarking a first-class obligation: choosing `pgvector` over stock NVIDIA RAG paths means the overlay must prove the retrieval store on its own merits. This spec defines what is measured, how results are recorded, and what acceptance means. The benchmark pass is `next` in the backlog ("PostgreSQL benchmark and ANF storage tuning") and depends on the live database path.

## Measures

Per `incubator/enterprise-azure-anf/runbooks/benchmarking.md`:

| Measure | Plane | Notes |
|---|---|---|
| Ingestion throughput | Ingestion | Documents and chunks per unit time through the packaged worker |
| Query latency | Retrieval | End-to-end `/v1/query` including embedding call |
| Retrieval recall | Retrieval | Hybrid RRF quality versus a labeled set; recall tuning is overlay-owned |
| Rerank latency | Inference | Reranker NIM round trip on multi-result candidate sets |
| Grounded answer latency | Agent path | Through guardrails and the Nemotron LLM |
| Model cold-start timing | Inference | With versus without the shared ANF-backed `NIMCache` |
| Snapshot and restore timing | Storage | ANF snapshot operations against DB and agent-memory volumes |

## Comparisons

Always compare:

- baseline without optimization,
- optimized path with ANF-backed cache or storage separation (WAL versus data volumes, service levels),
- performance before and after upstream syncs that affect runtime behavior.

## Recording Format

Record workload shape, environment matrix, volume class, result summary, and a regression threshold. Results feed the release record (spec 12): `Validated matrix: Azure <version>, AKS <version>, ANF <tiering/profile>, PostgreSQL <version>, NIM bundle <version>`.

## Acceptance Gates

| Gate | Criterion |
|---|---|
| A1 | Bootstrap and verify jobs pass against a real PostgreSQL deployment on ANF |
| A2 | Hybrid retrieval recall meets the agreed threshold on a labeled corpus before reranking is credited |
| A3 | Reranking measurably improves ordering quality without breaching the latency budget |
| A4 | PostgreSQL on ANF sustains the ingestion write rate with `hard` NFS mounts and separated WAL/data volumes |
| A5 | `NIMCache` reduces model cold-start versus per-pod pulls |
| A6 | DR drill completes within the recovery order of spec 08 with data loss bounded by snapshot cadence |

No gate is passed today; the storage-class profile and live retrieval path remain `assumed`.

## 2026-06 Currency Notes

These ecosystem facts (as of June 2026) shape the benchmark plan and must be re-verified at execution time:

- **pgvector 0.8.2** is the current release; it fixes CVE-2026-3172 (a parallel HNSW build buffer overflow), so the benchmark image must not pin an older 0.8.x. The 0.8.x line also adds iterative index scans (relevant to filtered recall measurement) and the `halfvec` and `sparsevec` types.
- **HNSW indexes cap at 2000 dimensions for the `vector` type.** The repo's original 3072-dimension `document_chunks` schema could not be HNSW-indexed as written; the fix is landing in the overlay. Benchmarks must run against the corrected schema, and recall comparisons should cover the chosen mitigation (dimension reduction or `halfvec`).
- **Iterative index scans** change the recall/latency trade-off for collection-filtered queries; benchmark with and without them before tuning `hnsw.ef_search` (currently 64 in the StatefulSet args).
- **ANF large volumes are GA, cool access is available, and an S3-compatible object REST API exists.** The volume-class matrix should include large-volume and cool-access variants where they change cost or throughput.
- **PostgreSQL on NFS requires `hard` mounts** (already encoded in `anf-postgres-rwo`) **and benefits from separate WAL and data volumes at different service levels** — the WAL-versus-data split is itself a benchmark axis, not just a default.

## Acceptance Beyond Performance

Functional acceptance for the retrieval path also requires the repo-owned validation surfaces to pass in order: `scripts/smoke-bootstrap.mjs` (env contract), the bootstrap job, `scripts/verify-live-postgres.mjs` (extension, table, indexes), then live query tests through `/v1/query` for both roles with policy summaries intact.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository. 2026-06 currency notes reflect ecosystem state at reconstruction time.
