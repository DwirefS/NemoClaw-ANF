<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Current-State Architecture (Hybrid Baseline)

This spec describes the supported deployment baseline locked by ADR-002. It is the topology every manifest, profile, and runbook in this incubator models.

## Topology

The baseline is a hybrid split inside one private Azure network boundary:

- **AKS data plane** hosts the RAG stack: ingestion, parse/OCR NIM, embedding NIM, reranker NIM, Nemotron LLM NIM, NeMo Guardrails, the retrieval API, and PostgreSQL with `pgvector`.
- **Worker tier** runs NemoClaw/OpenShell on isolated Azure Linux VMs or a dedicated worker tier, bootstrapped by `incubator/enterprise-azure-anf/manifests/nemoclaw-worker-tier.yaml` (cloud-init plus a systemd unit running `nemoclaw launch --profile enterprise-hybrid`).
- **ANF** is the shared persistence substrate across both planes.

The agent runtime never opens a direct PostgreSQL connection and never mounts the raw ANF document share. All knowledge access crosses the retrieval API seam (ADR-004).

## Why Hybrid, Not Full AKS

The reality-check source in the corpus (the DOCX draft) is explicit: the current NemoClaw/OpenShell runtime is closer to host-side onboarding plus sandbox orchestration than to a turnkey AKS control plane. Treating the agent runtime as AKS-native today would over-assume upstream behavior. Full AKS hosting is documented only in `incubator/enterprise-azure-anf/specs/04-future-state-full-aks-appendix.md` and is `blocked` in the tracker.

## Plane Responsibilities

| Plane | Components | Repo Evidence |
|---|---|---|
| Edge | Azure Application Gateway ingress to the worker-tier gateway | `manifests/private-connectivity.yaml` |
| Agent (worker tier) | NemoClaw plus OpenShell sandbox, enterprise env contract | `manifests/nemoclaw-worker-tier.yaml` |
| Guardrails | NeMo Guardrails service with mounted Colang config | `manifests/guardrails-service.yaml` |
| Inference | `NIMCache` plus `NIMService` resources for LLM, embedder, reranker, parse | `manifests/nim-services.yaml` |
| Retrieval | Retrieval API deployment, service, ingress network policy | `manifests/retrieval-api.yaml`, `enterprise/services/retrieval-api/` |
| Ingestion | NeMo Retriever ingest CronJob reading the ANF document PVC | `manifests/nv-ingest-trigger.yaml`, `enterprise/workers/nemo-retriever-ingest/` |
| Database | PostgreSQL StatefulSet with separate data and WAL volumes on ANF | `manifests/postgresql-pgvector-statefulset.yaml` |
| Storage | Trident backend and ANF storage classes by service level | `manifests/trident-backend-anf.yaml`, `manifests/storageclasses-anf.yaml` |

## Trust Zones

Field-agent (low trust, sanitized-only grounding) and vault-agent (high trust, restricted-enterprise grounding) are role profiles applied to the same runtime model, bridged by the A2A policy contract. Details are in `incubator/enterprise-azure-anf/specs/07-security-trust-zones-and-guardrails.md` and `incubator/enterprise-azure-anf/profiles/`.

## Network Boundaries

- The inference namespace accepts ingress only from the `rag` and `guardrails` namespaces and egresses only to them.
- The retrieval API accepts ingress only from the `worker-tier` and `ingestion` namespaces.
- Worker-tier egress to the data plane is limited to the retrieval API and guardrails endpoints named in the worker env contract.
- Secrets reach the `rag` namespace through the Azure Key Vault CSI `SecretProviderClass` with managed identity.

## Diagram Note

Mermaid sources under `incubator/enterprise-azure-anf/diagrams/` are canonical (ADR-006). The imported research diagram `arch_overview.mmd` shows the **aspirational** placement of the NemoClaw agent inside an AKS namespace; it is preserved intact as research lineage. The supported baseline places the agent on the worker tier as described here. When the diagram and this spec disagree about agent placement, this spec and ADR-002 win.

## Status

| Aspect | Status |
|---|---|
| Hybrid topology as supported target | `validated` |
| Retrieval API seam | `validated` |
| Worker-tier bootstrap contract | `assumed` (example cloud-init, not exercised against a live VM tier) |
| Private connectivity model | `assumed` (example manifests, not cluster-validated) |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
