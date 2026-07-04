<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Future State: Full AKS-Hosted NemoClaw (Non-Baseline Appendix)

**This document is an appendix, not the supported baseline.** A full AKS-hosted NemoClaw/OpenShell control plane is `blocked` in the engineering tracker and must not be presented as a supported deployment target. The supported baseline is the hybrid topology in `incubator/enterprise-azure-anf/specs/03-current-state-architecture-hybrid.md`, locked by ADR-002.

## Why This Appendix Exists

The long-form corpus sources (the whitepaper and the imported `arch_overview.mmd` diagram) describe an end state where the NemoClaw agent and the OpenShell proxy run inside AKS namespaces alongside the RAG plane. That vision is preserved here because:

- it informed the research narrative and the imported diagrams,
- some enterprise buyers will ask for a single-cluster story,
- the incubator should record what would have to change before it becomes viable.

The reality-check source (the DOCX draft) contradicts the vision for today's runtime, and the contradiction is recorded in `corpus/graph.json` (`claim-full-aks-runtime` contradicted by `claim-hybrid-runtime`).

## Sketch Of The Future State

In the aspirational topology:

- the NemoClaw agent (OpenClaw plus the NemoClaw plugin) runs in an agent namespace with OpenShell as an in-cluster L7 proxy and policy engine,
- guardrails mediate all inference traffic in-cluster,
- agent memory and skills mount ANF volumes directly from pods,
- field-agent and vault-agent zones become AKS namespaces (`field-agents`, `vault-agents`) with a guardrails bridge namespace between them, as drawn in `diagrams/multiagent_security.mmd`.

## What Would Have To Be True First

| Precondition | Current Reality | Status |
|---|---|---|
| Upstream NemoClaw supports cluster-native lifecycle (operator or equivalent) | NemoClaw is host-side onboarding plus sandbox orchestration around Docker | `blocked` |
| OpenShell sandbox model maps cleanly onto pod security boundaries | OpenShell assumes host-level Docker control (capability drops, process limits) | `blocked` |
| Secret flow is AKS-native (Workload Identity plus Key Vault CSI) end to end | Gateway-managed credentials remain the current NemoClaw/OpenShell pattern | `blocked` |
| Agent state and memory semantics survive pod rescheduling on ANF volumes | ANF-backed agent memory is an overlay pattern, not a validated upstream feature | `assumed` |
| Network policy can express the per-agent egress mediation OpenShell provides | Example namespace-level policies only | `assumed` |

## Migration Posture

If upstream maturity changes, the migration path is incremental:

1. Keep the retrieval API boundary unchanged; it is deliberately placement-agnostic (ADR-004).
2. Move the worker tier into a dedicated AKS node pool with the same env contract (`NEMOCLAW_RETRIEVAL_API`, `NEMOCLAW_GUARDRAILS_URL`, `NEMOCLAW_POLICY_PROFILE`).
3. Convert the cloud-init bootstrap into pod and operator manifests only after upstream provides a supported in-cluster runtime.
4. Re-evaluate the field/vault namespaces as runtime-enforced zones rather than design-input profiles.

Nothing in the supported baseline blocks this path, and nothing in this appendix is required for the baseline to work.

## How To Talk About This State

When writing specs, site content, or skills:

- describe full AKS hosting as a future-state appendix or experiment, never as the supported deployment target,
- attribute the vision to the whitepaper-family corpus sources and the imported `arch_overview.mmd` diagram,
- attribute the correction to the DOCX reality-check source and ADR-002,
- keep the tracker status (`blocked`) attached to any claim about it.

## Reassessment Trigger

Per the tracker, reassess only after upstream behavior and the operator story are clearer. Until then, contributors should not add manifests, profiles, or docs that assume cluster-native agent orchestration already exists upstream.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
