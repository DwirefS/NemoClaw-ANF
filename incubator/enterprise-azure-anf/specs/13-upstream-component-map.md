<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Upstream Component Map

This spec maps every external component the overlay depends on, what the overlay consumes from it, and where the dependency is encoded in this repo. It is the drift-control companion to the alignment tests in `test/enterprise-nvidia-alignment.test.ts`.

## NVIDIA Components

| Component | What We Consume | Repo Encoding | Status |
|---|---|---|---|
| NemoClaw / OpenClaw / OpenShell | Agent runtime, sandbox isolation, egress mediation, credential handling on the worker tier | `manifests/nemoclaw-worker-tier.yaml`, role profiles | `validated` as upstream baseline; worker-tier contract `assumed` |
| NIM Operator | `NIMCache` and `NIMService` resources (`apps.nvidia.com/v1alpha1`) for model deployment with a shared ANF-backed cache | `manifests/nim-services.yaml` | `validated` pattern |
| NeMo Retriever | Ingestion pipeline shape: `create_ingestor().files(...).extract(...).embed()`; pinned to `release/26.03` | `manifests/nv-ingest-trigger.yaml` provenance comments, `enterprise/workers/nemo-retriever-ingest/src/main.py` | `validated` shape, `assumed` live |
| Embedding NIM | `nvidia/nv-embedqa-e5-v5` via `/v1/embeddings` | `src/nvidia.ts`, `src/nim-http.ts`, `manifests/nim-services.yaml` | `validated` contract, `assumed` live |
| Reranker NIM | `nvidia/llama-nemotron-rerank-1b-v2` via `/v1/ranking` | same | `validated` contract, `assumed` live |
| Nemotron chat NIM | `nvidia/llama-3.1-nemotron-70b-instruct` via `/v1/chat/completions` | `src/nvidia.ts` | `validated` contract |
| Parse NIM | `nemotron-parse` for document extraction | `manifests/nim-services.yaml`, worker `PARSE_ENDPOINT` | `assumed` |
| NeMo Guardrails | Input and output rails with Colang config | `manifests/guardrails-service.yaml`, profile rails | `custom-build-required` for production rails |

All `manifests/` and `src/` paths above are under `incubator/enterprise-azure-anf/` and `enterprise/services/retrieval-api/` respectively.

## Azure And NetApp Components

| Component | What We Consume | Repo Encoding | Status |
|---|---|---|---|
| Azure NetApp Files | NFSv4.1 volumes across Standard/Premium/Ultra tiers, snapshots, SnapMirror, cloning, cool access | `manifests/storageclasses-anf.yaml`, `diagrams/anf_roles.mmd` | `assumed` performance profile |
| Astra Trident | `azure-netapp-files` CSI driver, backend config with managed identity | `manifests/trident-backend-anf.yaml` | `assumed` |
| AKS | Hosting for the RAG and data plane, namespaces as zone boundaries | all data-plane manifests | `validated` as design |
| Azure Application Gateway | Edge ingress with WAF to the worker-tier gateway | `manifests/private-connectivity.yaml` | `assumed` |
| Azure Key Vault + CSI driver | Secret delivery to the `rag` namespace via managed identity | `manifests/private-connectivity.yaml` | `assumed`; worker-tier path `blocked` |

## Data Components

| Component | What We Consume | Repo Encoding | Status |
|---|---|---|---|
| PostgreSQL 16 | Retrieval store host (`pgvector/pgvector:pg16` image) | `manifests/postgresql-pgvector-statefulset.yaml` | `assumed` |
| pgvector | `vector` type, HNSW cosine index, hybrid retrieval | `sql/001_document_chunks.sql`, `src/pgvector.ts` | `custom-build-required` (ADR-003) |

## 2026-06 Currency Notes

Verify these at the next alignment pass; they postdate the manifests:

- **pgvector 0.8.2** is the current release. It fixes CVE-2026-3172 (parallel HNSW build buffer overflow); 0.8.x also adds iterative index scans, `halfvec`, and `sparsevec`. The deployment image pin must pick up 0.8.2 or later.
- **HNSW caps at 2000 dimensions for the `vector` type** — the repo's original 3072-dim schema could not be indexed and the fix is in flight in the overlay (spec 10).
- **NeMo Retriever (nv-ingest) active branch is `release/26.1.2`**, while the repo pins `release/26.03`. Re-validate the ingestor chain shape against the active branch before bumping the pin.
- **NIM Operator** manages `NIMCache`/`NIMService` (`apps.nvidia.com/v1alpha1`) and now also NeMo microservices including guardrails — the guardrails Deployment in `manifests/guardrails-service.yaml` could move under the Operator model.
- **ANF** now has large volumes GA, cool access, and an S3-compatible object REST API.
- **AKS secret best practice** is Workload Identity plus the Key Vault CSI driver; the `SecretProviderClass` example uses VM managed identity and should be reviewed against Workload Identity when the secret-alignment item unblocks.

## Ownership Boundary

Everything in this map is consumed, not forked. The overlay's own components — the retrieval API, the ingestion worker, the role profiles, the manifests, and the site — integrate with the components above through versioned contracts (HTTP payload shapes, CRDs, storage classes, branch pins). The upstream diff register confirms zero patches against NemoClaw core itself; component drift is handled by updating overlay encodings, never by patching the upstream component.

## Drift Control

When any upstream component changes: update the encoding files above, update the alignment tests, log the pass in the program logbook, and adjust tracker statuses. Never let manifests claim versions or shapes the tests do not check.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository. 2026-06 currency notes reflect ecosystem state at reconstruction time.
