<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Executive Summary

This spec set turns the supplied Enterprise Azure ANF research corpus into an implementation-ready architecture and deployment program for running NemoClaw/OpenClaw agents against an enterprise RAG plane on Azure.

The program combines:

- Azure NetApp Files (ANF) as the shared persistence substrate,
- AKS as the home of the RAG and data plane,
- NVIDIA NIM services for embedding, reranking, parsing, and Nemotron chat,
- PostgreSQL with `pgvector` as the chosen retrieval store,
- a project-owned internal retrieval API as the enterprise seam,
- a NemoClaw/OpenShell worker tier isolated from the data plane.

## Supported Baseline

The supported baseline is a hybrid topology, locked by ADR-002:

- AKS hosts the RAG and data plane: ingestion, parse, embedding, reranking, LLM NIMs, guardrails, retrieval API, and PostgreSQL with `pgvector`.
- NemoClaw/OpenShell runs on an isolated worker or VM tier in the same private Azure network boundary.
- Agents reach enterprise knowledge only through the internal retrieval API, never by direct PostgreSQL access or raw ANF document-share mounts.

A full AKS-hosted NemoClaw/OpenShell control plane is documented only as a future-state appendix in `incubator/enterprise-azure-anf/specs/04-future-state-full-aks-appendix.md` and remains `blocked` in the engineering tracker.

## Locked Decisions

| ADR | Decision |
|---|---|
| ADR-001 | Incubator-first repo surface; no official docs or generated `nemoclaw-user-*` skill changes |
| ADR-002 | Hybrid baseline is the supported target |
| ADR-003 | PostgreSQL with `pgvector` is the chosen retrieval store |
| ADR-004 | Retrieval API boundary between the agent plane and the RAG plane |
| ADR-005 | Field-agent and vault-agent role separation as role profiles, not new runtimes |
| ADR-006 | Mermaid `.mmd` files are the canonical diagram sources |

ADR sources live in `incubator/enterprise-azure-anf/adrs/`.

## Current Status Snapshot

Status framing follows the tracker vocabulary: `validated`, `assumed`, `custom-build-required`, `blocked`.

| Area | Status |
|---|---|
| Hybrid baseline topology, retrieval API boundary, NIM contracts, program control surfaces | `validated` |
| PostgreSQL plus `pgvector` retrieval path and hybrid dense-plus-sparse logic | `custom-build-required` |
| Live PostgreSQL bootstrap, live NIM integration, ingestion worker, ANF storage profile, agent memory on ANF | `assumed` |
| ACL-aware retrieval filtering, Azure-native secret alignment, full AKS-hosted agent runtime | `blocked` |

The authoritative live status table is `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`.

## What Exists In The Repo Today

- Project-owned retrieval API runtime code under `enterprise/services/retrieval-api/`, including contracts, role policy, a hybrid RRF query planner, NIM HTTP clients, SQL migrations, a bootstrap runner, and live-verification scripts.
- A project-owned NeMo Retriever ingestion worker under `enterprise/workers/nemo-retriever-ingest/`.
- Example deployment manifests under `incubator/enterprise-azure-anf/manifests/` for ANF, PostgreSQL, NIM services, guardrails, retrieval, ingestion, worker tier, and private connectivity.
- A public site surface under `site/` and a repo-owned artifact store, kept outside upstream NemoClaw docs.
- Program control surfaces in specs 15 through 18 plus contributor skills under `.agents/skills/`.

## Read Order

1. This summary.
2. `incubator/enterprise-azure-anf/specs/03-current-state-architecture-hybrid.md`
3. `incubator/enterprise-azure-anf/specs/05-data-plane-rag-and-pgvector.md`
4. `incubator/enterprise-azure-anf/specs/13-upstream-component-map.md`
5. `incubator/enterprise-azure-anf/specs/14-observations-and-considerations-log.md`
6. Specs 15 through 18 for status, chronology, backlog, and execution rules.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
