<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Risks, Gaps, And Promotion Criteria

This spec consolidates the program's known risks, the open gaps with their tracker status, and the gate that controls promotion of incubator content into official surfaces.

## Risk Register

The corpus graph (`incubator/enterprise-azure-anf/corpus/graph.json`) records four standing risks:

| Risk | Description | Mitigation Posture |
|---|---|---|
| `risk-product-maturity` | NemoClaw/OpenShell maturity: the runtime is not an AKS-native control plane today | Hybrid baseline (ADR-002); full AKS stays a `blocked` appendix |
| `risk-custom-pgvector` | Custom `pgvector` integration: schema, indexing, ingestion, and retrieval logic are overlay-owned | ADR-003 plus mandatory benchmarking (spec 10) |
| `risk-acl-retrieval` | ACL-aware retrieval gap: collection-level policy does not bound per-principal access | Highest-priority `blocked` item; see below |
| `risk-ops-complexity` | Operational complexity and platform cost across ANF, AKS, NIMs, PostgreSQL, and the worker tier | Workstream sequencing (spec 09), runbooks, release matrix discipline |

## Open Gaps

| Gap | Status | Notes |
|---|---|---|
| ACL-aware retrieval filtering and permission capture | `blocked` | The highest enterprise grounding risk. Depends on an identity model, permission ingestion, and a metadata model. A first metadata-model implementation is landing in the overlay as of 2026-06-12; identity mapping and retrieval-time enforcement remain open. The target pattern is principal filtering pushed into SQL (alongside the existing `collection = ANY(...)` predicate), with optional PostgreSQL row-level security — noting the `LEAKPROOF` caveat that non-leakproof RLS predicates can defeat index use. |
| Azure-native secret path alignment | `blocked` | AKS-native Key Vault flows (Workload Identity plus the Key Vault CSI driver, the current AKS best practice) versus gateway-managed credentials on the worker tier are not yet normalized into one supported path. |
| Agent memory and state on ANF | `assumed` | A valid overlay pattern, not a turnkey upstream feature; mount, restore, and failure behavior under the worker-tier model are unvalidated. |
| Live NIM validation (embedding and reranker) | `next` | HTTP clients are tested against mocked responses only. |
| Live NeMo Retriever validation | `next` | Worker output normalization needs real-data proof; chunk normalization is intentionally conservative. |
| Live PostgreSQL validation | `next` | Bootstrap, smoke, and verify surfaces exist but have not run against a real cluster database. |
| HNSW dimension mismatch | `custom-build-required` | The 3072-dim `vector` column exceeds the 2000-dim HNSW cap; fix in progress in the overlay (see spec 10 currency notes). |
| Raw corpus sources not committed | provenance limitation | Only normalized derivatives under `corpus/` are in-repo; claims tracing solely to raw sources stay `assumed` until re-evidenced. |

## Gap Interactions

Per the backlog dependency notes: permission capture during ingestion is a prerequisite for ACL-aware retrieval filtering, and ACL-aware retrieval filtering is a prerequisite for enterprise-safe restricted grounding. Until both land, the vault-agent's `enterprise-sensitive` and `enterprise-regulated` collections must be treated as coarse-grained and populated only with content acceptable to every principal authorized for the vault role.

## Watch Items From Operations

The ingestion runbook adds operational risks that have not yet bitten but are expected once the live path runs:

- duplicate ingestion (protection is `later` in the backlog, likely content-hash or source-version based),
- parse failures on complex documents,
- embedding timeouts,
- backlog growth between ANF source updates and index availability,
- unauthorized ingestion of restricted data classes — the ingestion-side twin of the ACL gap.

## Promotion Criteria

Per `incubator/enterprise-azure-anf/runbooks/promotion-to-official-docs.md`, do not move incubator content into official docs or generated `nemoclaw-user-*` skills unless:

- the supported baseline is validated,
- the guidance is no longer speculative,
- controlled-overlap patches are understood,
- the release model names the upstream base clearly.

Promotion sequence: confirm stability, confirm the content is user-facing rather than contributor-only, update official docs, run the docs-to-skills dry run, and keep generated user skills out of normal incubator PRs unless explicitly promoting.

## Promotion Readiness Today

Not ready. The supported baseline has `validated` design surfaces but `assumed` live behavior, two `blocked` security items, and no benchmark evidence. The public `site/` surface (which carries its own non-affiliation disclaimer and honest validated-versus-custom framing) is the only intentionally public output; official NemoClaw docs remain untouched per ADR-001.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
