<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# NemoMaxxing Deployable Stack (2026-06-12)

This plan records the second 2026-06-12 implementation wave: turning the validated retrieval slice into a deployable end-to-end platform, codenamed **NemoMaxxing** (working title for the public write-up: "NVIDIA NemoMaxxing with Azure and Azure NetApp Files").

## Goal

A cloud engineer — or an AI agent given this repository and its skills — can deploy the full pipeline: ANF document file share → NeMo Retriever (nv-ingest) extraction, chunking, and embedding NIMs → PostgreSQL + pgvector on ANF → retrieval API boundary → Nemotron and multi-engine Gemma inference on AKS GPU pools → NemoClaw agents on the worker tier → web console. Persistent storage is ANF at every layer; infrastructure is Azure; GPU compute and the application stack are NVIDIA.

## Decisions And Rationale

| Decision | Choice | Why |
|---|---|---|
| Console UI | Project-owned dependency-free console (`enterprise/services/console/`) rather than adopting NVIDIA's RAG blueprint frontend | The overlay's differentiators (field/vault roles, principals, ACL visibility) need first-class controls a generic RAG playground does not expose; the console talks only to the retrieval API, so any other frontend can be swapped in later |
| Chat protocol | OpenAI-compatible `/v1/chat/completions` | One console code path serves Nemotron NIM, vLLM, and SGLang identically |
| Default chat model | `nvidia/llama-3.1-nemotron-ultra-253b-v1`, with the 70B Nemotron documented as the cost-down swap | Matches the "Nemotron Ultra inferencing" target while keeping a budget path |
| Multi-engine inference | NIM (TRT-LLM engine) for Nemotron; vLLM and SGLang deployments for Gemma | Demonstrates engine plurality without inventing a router; all expose the same API shape |
| GPU-accelerated vector search | Stay on pgvector (ADR-003); evaluate cuVS/Milvus-GPU only via a future ADR | ADR-003 is a locked decision; GPU ANN is a measurable benchmark question, not a default |
| Storage layout | Dedicated ANF volumes: models-cache, pg-wal (ultra), pg-data (premium), rag-documents (standard), agent-workspace | Mirrors spec 08; separates WAL from data; the RAG source share is the ingestion entry point |
| Agent operability | Four `nemomaxxing-*` skills (overview, deploy-azure-infra, deploy-platform, validate-and-operate) | Encodes the runbook as skills so handing the repo to an agent is sufficient |
| Naming | NemoMaxxing kept to overlay surfaces (console, deploy tree, skills, plans) | Upstream NemoClaw docs and generated user skills stay untouched per ADR-001 |

## What Was Built And Validated In This Wave

- `enterprise/services/console/` — server, grounded-prompt composer, single-page UI, Dockerfile, unit tests, and a live e2e (`npm run e2e:local`) that passed against the real PostgreSQL + pgvector stack: grounded chat with citations, vault-agent principal unlock, field-agent ACL isolation, and policy inspection.
- `enterprise/deploy/` — Bicep infrastructure (VNet with ANF-delegated subnet, ANF account/pools/volumes, AKS with GPU pool and workload identity, Key Vault), numbered Kubernetes manifests (PostgreSQL with split WAL/data ANF volumes, RAG NIMs, Nemotron NIMService, Gemma on vLLM and SGLang, nv-ingest pipeline, retrieval API, console, worker tier), and staged deploy/validate scripts.
- Four `nemomaxxing-*` agent skills plus guide integration and structural tests.
- CI now runs the console e2e alongside the retrieval e2e against a pgvector service container.

## Validation Status (Honest)

- `validated` — retrieval path and console, locally and in CI against real PostgreSQL/pgvector with mocked NIM contracts.
- `assumed` — Bicep templates and Kubernetes manifests: internally consistent and structurally tested, but never applied to a real Azure subscription or GPU cluster from this repository.
- `blocked` — identity mapping for principals, automatic ANF ACL capture, live NIM/GPU validation (requires Azure + GPU quota).

The first real `az deployment` run is itself the next validation event and must be logged.

## Follow-Ups

1. Apply the deploy tree to a real subscription (skills 2-4 are the runbook).
2. Replace mock NIM endpoints in the e2e with live NIMService endpoints in-cluster.
3. Add the authenticating gateway (Entra ID) in front of the retrieval API before any multi-user exposure.
4. Benchmark per spec 10; only then consider the cuVS/Milvus-GPU ADR.
