<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Requirements And Success Criteria

This spec states what the Enterprise Azure ANF program must deliver and how completion is judged. Requirements are framed honestly: some are already `validated` in this repo, others remain `assumed`, `custom-build-required`, or `blocked`.

## Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | AKS hosts the RAG and data plane; NemoClaw/OpenShell runs on an isolated worker or VM tier in the same private network | `validated` (design and manifests) |
| FR-02 | Agents reach enterprise knowledge only through the internal retrieval API | `validated` (ADR-004, `enterprise/services/retrieval-api/`) |
| FR-03 | Field-agent and vault-agent role separation enforced at the retrieval boundary | `validated` (profiles, `src/policy.ts`, `src/profiles.ts`) |
| FR-04 | PostgreSQL with `pgvector` provides hybrid dense plus sparse retrieval with RRF fusion | `custom-build-required` (planner and backend exist; live tuning remains) |
| FR-05 | Document ingestion from ANF through the NeMo Retriever pipeline into `document_chunks` | `assumed` (worker package exists; live validation pending) |
| FR-06 | NIM-backed embedding, reranking, parsing, and Nemotron chat via documented contracts | `validated` contracts, `assumed` live behavior |
| FR-07 | Guardrails input and output rails on agent traffic | `assumed` (example manifest and profile rails only) |
| FR-08 | ACL-aware retrieval filtering tied to source permissions | `blocked` |
| FR-09 | Agent memory and selected state persisted on ANF volumes | `assumed` |
| FR-10 | Disaster recovery through ANF snapshots, replication, and service-boundary rollback | `assumed` (runbook exists; not exercised) |

## Non-Functional Requirements

| ID | Requirement | Notes |
|---|---|---|
| NFR-01 | All enterprise code stays in project-owned overlay paths (`enterprise/`, `incubator/`, `site/`, `artifacts/`) | Enforced by the repo strategy in spec 12 |
| NFR-02 | Upstream NemoClaw remains syncable through `vendor/nvidia-main` | See `incubator/enterprise-azure-anf/runbooks/upstream-sync-and-overlay-release.md` |
| NFR-03 | All egress between zones is private; inference namespaces accept traffic only from `rag` and `guardrails` namespaces | `manifests/private-connectivity.yaml` |
| NFR-04 | No direct PostgreSQL or raw ANF document-share access from agents | Encoded in `profiles/shared-policy-contract.yaml` and the retrieval policy summary |
| NFR-05 | Security-sensitive paths carry extra test coverage | Repo-level testing convention |
| NFR-06 | Status claims must use the tracker vocabulary and not overstate maturity | Specs 15-18 govern this |

## Success Criteria

The program is successful for its current phase when:

1. The full spec, ADR, profile, manifest, and runbook set exists and passes repo tests (`test/enterprise-azure-anf-incubator.test.ts`, `test/enterprise-program-control.test.ts`).
2. The retrieval API enforces role-aware collection filtering and result limits, with tests covering health, validation, filtering, and query-plan generation.
3. The bootstrap and verification harness can prepare and check a real PostgreSQL deployment (`npm run bootstrap`, `npm run verify:postgres`).
4. The ingestion worker produces schema-conformant `document_chunks` rows from real documents.
5. Benchmark results exist for the measures in `incubator/enterprise-azure-anf/runbooks/benchmarking.md`.
6. ACL-aware retrieval has a designed metadata model, identity mapping, and enforcement point before any restricted corpus is exposed to agents.

Criteria 1 and 2 are met today. Criteria 3 through 5 are `next` in the delivery backlog. Criterion 6 is `blocked` and is the highest enterprise grounding risk.

## Verification Mapping

| Criterion | Verified By |
|---|---|
| Spec and asset completeness | `test/enterprise-azure-anf-incubator.test.ts`, `test/enterprise-program-control.test.ts` |
| Retrieval policy behavior | `test/enterprise-retrieval-api.test.ts`, `test/enterprise-retrieval-query-plan.test.ts` |
| Bootstrap and verification surfaces | `test/enterprise-retrieval-bootstrap*.test.ts`, `test/enterprise-retrieval-live-postgres-*.test.ts` |
| NIM contract alignment | `test/enterprise-nvidia-alignment.test.ts`, `test/enterprise-nim-http-clients.test.ts` |
| Ingestion worker shape | `test/enterprise-ingestion-worker.test.ts` |

## Explicit Non-Goals

- No NemoClaw CLI, plugin API, or runtime code changes in this phase.
- No generated `nemoclaw-user-*` skill changes in this phase.
- No claim that a full AKS-hosted NemoClaw/OpenShell control plane is supported.
- No promotion of incubator content into official docs before the gate in `incubator/enterprise-azure-anf/runbooks/promotion-to-official-docs.md` is satisfied.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
