<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Observations And Considerations Log

This log records the observations and design considerations that emerged from the research corpus and from implementation. The engineering tracker (spec 15) converts these into status items; this log preserves the reasoning. Entries use the tracker vocabulary where a status is implied.

## Runtime And Topology

- The current NemoClaw/OpenShell runtime is host-side onboarding plus Docker sandbox orchestration, not a turnkey AKS control plane. The DOCX reality-check source is the strongest corrective here, and it drove ADR-002. Treating full AKS hosting as anything other than `blocked` would overstate upstream maturity.
- The imported `arch_overview.mmd` diagram shows the agent inside an AKS namespace. It is preserved intact as research lineage, but the baseline diverges: the agent lives on the worker tier. Imported diagrams record where the research was; incubator specs record where the program is.
- OpenShell remains the key security boundary on the agent side regardless of placement. Nothing in the overlay weakens or replaces it.

## Retrieval Store

- `pgvector` is viable but custom relative to stock NVIDIA vector-store paths. The contradiction (`claim-pgvector-target` versus `claim-stock-vdb-path`) is resolved by ADR-003, which converts it into owned work: schema, indexing, ingestion writes, retrieval logic, and benchmarking.
- The hybrid RRF planner deliberately pushes collection filtering into both the vector and full-text CTEs so policy is enforced in SQL, not by post-filtering. This is also the intended landing zone for principal-level ACL filtering later.
- **2026-06 currency note:** `pgvector` 0.8.2 is current and fixes CVE-2026-3172 (parallel HNSW build buffer overflow); 0.8.x adds iterative index scans, `halfvec`, and `sparsevec`. Iterative index scans materially change filtered-query recall behavior and should be part of the benchmark matrix.
- **2026-06 currency note:** HNSW indexes cap at 2000 dimensions for the `vector` type. The original `embedding vector(3072)` column in `sql/001_document_chunks.sql` therefore could not actually be HNSW-indexed — a real defect inherited from the research-era schema, being fixed in the overlay (dimension reduction or `halfvec`).

## Security

- ACL-aware retrieval is critical and not solved by the raw corpus. Collection-level filtering bounds roles, not principals. The viable pattern is principal filtering pushed into SQL with an optional PostgreSQL RLS layer — with the caveat that RLS predicates must be `LEAKPROOF` for the planner to keep using indexes; non-leakproof functions force row-by-row checks and can wreck retrieval latency.
- Secret management is genuinely contradictory today: AKS-native flows (Workload Identity plus the Key Vault CSI driver, the current best practice) for the data plane versus gateway-managed credentials in the NemoClaw/OpenShell pattern on the worker tier. The contradiction is kept visible in `corpus/graph.json` rather than papered over; alignment is `blocked`.
- The field/vault pattern works only as role profiles plus a bridge contract. Turning it into a new top-level runtime boundary would be a false product claim (ADR-005).

## Storage

- PostgreSQL on NFS requires `hard` mounts for correctness — `soft` mounts can corrupt on timeout. The `anf-postgres-rwo` class encodes `hard,nconnect=8,rsize=65536,wsize=65536`.
- Separate WAL and data volumes pay off twice: they isolate write-ahead throughput and allow different ANF service levels per volume. The StatefulSet models this with distinct `pgdata` and `pgwal` claims.
- Snapshot-as-memory (ANF snapshots and clones as agent checkpoints) is an attractive enriched-corpus pattern but remains `assumed`; restore semantics against live agent state are unexercised.
- **2026-06 currency note:** ANF now has large volumes GA, cool access, and an S3-compatible object REST API. The object API suggests a future ingestion path without NFS mounts in the ingestion namespace.

## Ecosystem Pins

- **2026-06 currency note:** the nv-ingest active branch is `release/26.1.2`; the repo pins `release/26.03`. Re-validate the `create_ingestor().files(...).extract(...).embed()` chain shape before bumping.
- **2026-06 currency note:** the NIM Operator now manages NeMo microservices including guardrails in addition to `NIMCache`/`NIMService` (`apps.nvidia.com/v1alpha1`); the hand-rolled guardrails Deployment is a candidate for Operator management.

## Ingestion

- The documented NeMo Retriever chain shape matters more than it looks: the worker initially passed an embedding endpoint into `.embed(...)` and broke the alignment test that pins the documented no-arg `.embed()` chain. The worker was changed to match the documented shape (logbook conflict record).
- Default ingestion classification is deliberately conservative: `enterprise-public` collection with `internal-sanitized` classification, so nothing lands in vault-only collections by accident.
- The 512-token chunking with 50-token overlap in `ingestion_flow.mmd` is a research-era starting point, not a tuned value; chunking strategy belongs to the benchmark pass.

## Verification Surfaces

- The DSN check in `verify-live-postgres.mjs` runs before the `pg` import so the missing-DSN failure mode stays truthful even before dependency resolution — a small decision recorded in the logbook because it shaped the operator experience.
- Smoke validation (`smoke-bootstrap.mjs`) checks the env contract without touching the database; this split lets deployment pipelines fail fast on configuration before failing slow on connectivity.

## Process Observations

- Recording contradictions in `graph.json` instead of resolving them silently has already paid off: the secrets and runtime-placement tensions resurfaced during implementation exactly where the graph predicted.
- Packaging beat inlining: replacing the heredoc ingest script with a packaged worker image broke a provenance test, which was resolved by adding source-provenance comments to the manifest — both truths (deployment surface and upstream lineage) now stay visible.
- Status honesty is enforced structurally: every claim in specs and the public site must map to a tracker status, and the delivery-status page mirrors the validated-versus-custom split rather than marketing the target state.
- The raw research bundle was never committed to this repository; only the `corpus/` derivatives are. Future contributors should treat raw-source-only claims as `assumed`.
- New observations belong here as bullets under the matching section; status changes they imply belong in the tracker, and the work that produced them belongs in the logbook.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository. 2026-06 currency notes reflect ecosystem state at reconstruction time.
