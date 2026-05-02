<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Enterprise Azure ANF Incubator

This incubator packages the research corpus, architecture decisions, role profiles, and example deployment assets for an enterprise Azure platform that combines Azure NetApp Files, AKS, NVIDIA NIM services, PostgreSQL with `pgvector`, and a NemoClaw/OpenShell agent runtime.

This package is intentionally separate from `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/docs` and from generated `nemoclaw-user-*` skills. It is a contributor-facing program kit, not an official productized user guide.

## Working Model

- `corpus/` normalizes the supplied research set and records contradictions, supersession, and canonical reading order.
- `specs/` turns the corpus into an implementation-ready architecture and deployment spec.
- `adrs/` locks decisions that should remain stable while the incubator evolves.
- `diagrams/` tracks Mermaid sources. Imported research diagrams stay intact, and incubator-authored diagrams represent the supported baseline.
- `profiles/` defines the field-agent and vault-agent role boundaries without introducing new top-level agent runtimes.
- `manifests/` provides example assets for ANF, AKS, NIMs, PostgreSQL, retrieval, ingress, and the worker-tier runtime.
- `runbooks/` covers operating patterns, disaster recovery, rollout, and future promotion into official NemoClaw documentation.

## Supported Baseline

The supported baseline in this incubator is a hybrid topology:

- AKS hosts the RAG and data plane.
- NemoClaw/OpenShell runs in an isolated worker or VM tier in the same private Azure network boundary.
- The agent reaches enterprise knowledge through an internal retrieval API, not by direct unrestricted access to PostgreSQL or the raw ANF document share.

## Read Order

1. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/00-executive-summary.md`
2. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/03-current-state-architecture-hybrid.md`
3. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/05-data-plane-rag-and-pgvector.md`
4. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/13-upstream-component-map.md`
5. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/14-observations-and-considerations-log.md`
6. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
7. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/16-program-logbook.md`
8. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`
9. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`
10. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/07-security-trust-zones-and-guardrails.md`
11. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md`
12. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/corpus/canonical-source-map.md`
13. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/12-repo-strategy-and-upstream-sync.md`
14. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/runbooks/upstream-sync-and-overlay-release.md`
15. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/runbooks/overlay-adoption-plan.md`

## Notable Boundaries

- No NemoClaw CLI, plugin API, or runtime code changes are part of this first pass.
- No generated `nemoclaw-user-*` skill changes are part of this first pass.
- A full AKS-hosted NemoClaw/OpenShell control plane is documented only as a future-state appendix.
- The local branch `vendor/nvidia-main` is reserved as the fast-forward upstream mirror for `upstream/main`.
