---
name: nemomaxxing-overview
description: Use when orienting on the NemoMaxxing platform — the deployable end-to-end NVIDIA-on-Azure stack built on this NemoClaw fork — to understand the three-layer model, the architecture, which skills to load next, and what is actually validated versus aspirational. Trigger keywords - nemomaxxing, end to end deploy, full stack, azure anf nvidia.
---

# NemoMaxxing Overview

NemoMaxxing is the codename for the deployable end-to-end platform built from this repository's Enterprise Azure ANF overlay: NVIDIA NemoClaw agents plus a full RAG data plane, deployed on Azure, with Azure NetApp Files (ANF) as the persistence substrate for everything.

## Read Order

1. This skill (orientation and honest status).
2. `incubator/enterprise-azure-anf/specs/03-current-state-architecture-hybrid.md` — the supported hybrid baseline topology.
3. `incubator/enterprise-azure-anf/specs/07-security-trust-zones-and-guardrails.md` — field-agent versus vault-agent trust model.
4. `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` — current per-item status (`validated` / `assumed` / `custom-build-required` / `blocked`).
5. `enterprise/deploy/README.md` — the deployment asset layout.
6. `enterprise/services/retrieval-api/README.md` — the retrieval boundary env contract and validation commands.

## Use This Skill When

- you were handed this repo and asked to deploy, validate, or operate the whole platform
- you need to know what NemoMaxxing is and how its pieces fit together
- you need to decide which NemoMaxxing skill to load next
- you need an honest answer about what has been proven versus what is design-only

## The Three-Layer Model

| Layer | Provides | Key Assets |
|---|---|---|
| Azure infrastructure | VNet, AKS with GPU node pool, Key Vault, workload identity | `enterprise/deploy/azure/main.bicep`, `enterprise/deploy/azure/modules/` |
| ANF storage everywhere | ALL persistent storage: model caches, PostgreSQL WAL (ultra) + data (premium), RAG document share, agent workspace state | `enterprise/deploy/azure/modules/anf.bicep`, `enterprise/deploy/k8s/10-storageclasses-anf.yaml` |
| NVIDIA compute | NIMs (Nemotron, embedder, reranker, parse), GPU Operator, NIM Operator, multi-engine Gemma | `enterprise/deploy/k8s/30-nim-rag-services.yaml`, `31-nemotron-nimservice.yaml`, `32-gemma-vllm.yaml`, `33-gemma-sglang.yaml` |

There is no persistent disk in the design that is not ANF-backed. If a workload writes state, it writes to an ANF volume.

## Architecture (Data Flow)

1. Documents land on the **ANF rag-documents share**.
2. The **nv-ingest NeMo Retriever pipeline** (`enterprise/deploy/k8s/40-nv-ingest-pipeline.yaml`, worker code in `enterprise/workers/nemo-retriever-ingest/`) extracts, chunks, and embeds them.
3. Chunks and embeddings are written to **PostgreSQL + pgvector on ANF** (`enterprise/deploy/k8s/20-postgresql-pgvector.yaml`; separate WAL and data volumes).
4. The **retrieval API** (`enterprise/services/retrieval-api/`, deployed by `enterprise/deploy/k8s/50-retrieval-api.yaml`) is the only boundary through which agents reach knowledge. It enforces field-agent versus vault-agent policy and ACL principals. Agents never touch PostgreSQL or the raw ANF share directly.
5. Generation runs on **Nemotron Ultra NIM** (`31-nemotron-nimservice.yaml`, with a documented 253B-ultra versus 70B cost-down swap) and **multi-engine Gemma** — vLLM (`32-gemma-vllm.yaml`), SGLang (`33-gemma-sglang.yaml`), and TRT-LLM via NIM.
6. **NemoClaw agents** run on the worker tier (`enterprise/deploy/k8s/70-nemoclaw-worker-tier.yaml`), grounded only through the retrieval API.
7. The **console UI** (`enterprise/services/console/`, deployed by `enterprise/deploy/k8s/60-console.yaml`, port 8090) fronts the stack for humans.

## Skill Load Order

Load the NemoMaxxing skills in this order for a full deployment:

1. `nemomaxxing-overview` (this skill)
2. `nemomaxxing-deploy-azure-infra` — Bicep infra plus cluster bootstrap (`enterprise/deploy/scripts/01-deploy-infra.sh`, `02-bootstrap-cluster.sh`)
3. `nemomaxxing-deploy-platform` — apply `enterprise/deploy/k8s/` manifests in numbered order with readiness gates (`03-deploy-stack.sh`)
4. `nemomaxxing-validate-and-operate` — e2e validation, ingestion operations, troubleshooting, benchmarking (`04-validate-e2e.sh`)

For deeper background, the incubator contributor skills (`nemoclaw-contributor-enterprise-azure-anf-architecture`, `-deployment`, `-execution-control`) cover the design rationale and change-control rules.

## Honest Status Ledger

Use the tracker vocabulary from `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`: `validated`, `assumed`, `custom-build-required`, `blocked`.

| Area | Status | Reality |
|---|---|---|
| Retrieval API boundary, schema bootstrap, role + ACL enforcement | `validated` | Exercised end to end locally and in CI (`npm run e2e:local` against real PostgreSQL 16 + pgvector 0.8.2; `.github/workflows/enterprise-retrieval-e2e.yaml`) |
| Embedding dimension and index contract (`vector(1024)`) | `validated` | Proven against a live database; HNSW caps at 2000 dims |
| Embedding / reranker NIM HTTP clients | `assumed` | Tested against mocks only; never against a deployed NIM |
| nv-ingest ingestion worker | `assumed` | Package exists; never run against live NeMo Retriever output |
| PostgreSQL + pgvector as the retrieval store | `custom-build-required` | Deliberate overlay choice, ours to own and tune |
| Azure infra (Bicep), AKS, ANF volumes, GPU pool | never run on Azure | `assumed` — no manifest or script in `enterprise/deploy/` has touched a real Azure subscription yet |
| Worker tier, private connectivity, secret paths | `assumed` / `blocked` | Azure-native secret alignment and identity mapping for asserted principals are `blocked` |
| Production guardrail rails | `custom-build-required` | Checked-in Colang config is a placeholder |

When you report progress, never describe an `assumed` step as proven. Cluster validation on AKS + ANF is the top open item in `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`.

## Common Mistakes

- Presenting the full stack as production-proven when only the local/CI retrieval path is `validated`.
- Letting an agent bypass the retrieval API to reach PostgreSQL or the raw ANF document share.
- Treating the full-AKS-hosted agent model as the baseline; the supported baseline is hybrid (RAG plane on AKS, agents on the worker tier).
- Using non-ANF storage for any persistent volume.
- Skipping the tracker/logbook updates required by `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md` after deployment passes.
