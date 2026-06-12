<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Agent Runtime And OpenShell Boundary

This spec defines how the NemoClaw/OpenShell agent runtime participates in the enterprise topology without absorbing data-plane responsibilities.

## Runtime Placement

NemoClaw/OpenShell runs on an isolated worker or VM tier inside the same private Azure network as the AKS data plane (ADR-002). The runtime stays what upstream NemoClaw is today: a secured reference stack for OpenClaw agents inside OpenShell sandboxes, with host-side onboarding and Docker-based sandbox orchestration. The overlay does not patch NemoClaw core to make this work (ADR-001, repo strategy in spec 12).

## Worker-Tier Bootstrap Contract

`incubator/enterprise-azure-anf/manifests/nemoclaw-worker-tier.yaml` defines the example bootstrap:

- cloud-init installs Docker and writes `/etc/nemoclaw/enterprise.env`,
- a systemd unit `nemoclaw-enterprise.service` runs `nemoclaw launch --profile enterprise-hybrid`,
- the env contract names the only enterprise endpoints the agent needs:

| Variable | Value |
|---|---|
| `NEMOCLAW_RETRIEVAL_API` | `http://retrieval-api.rag.svc.cluster.local:8080` |
| `NEMOCLAW_GUARDRAILS_URL` | `http://nemo-guardrails.guardrails.svc.cluster.local:8000` |
| `NEMOCLAW_POLICY_PROFILE` | `enterprise-hybrid` |

This contract is `assumed`: it is an example asset, not yet exercised against a live worker tier.

## The Knowledge Boundary

Agents reach enterprise knowledge **only** through the retrieval API (ADR-004). The boundary is enforced redundantly:

- `profiles/shared-policy-contract.yaml` sets `directPostgresAccessFromAgents: false`, `directANFDocumentShareAccessFromAgents: false`, and `retrievalApiRequired: true`,
- both role profiles set `retrievalScope.directDatabaseAccess: false`,
- every retrieval response carries a policy summary with `directDatabaseAccess: false` and `directDocumentShareAccess: false` (`enterprise/services/retrieval-api/src/contracts.ts`),
- the retrieval API ingress network policy admits only the `worker-tier` and `ingestion` namespaces.

The consequence is that agent-side enterprise logic stays thin: query, role, optional collections, optional max results. Evidence shaping, policy, and authorization are service responsibilities.

## OpenShell's Role

OpenShell remains the key security boundary on the agent side:

- sandbox isolation around the OpenClaw agent (Docker capability drops, process limits),
- egress mediation so the sandbox can reach only policy-approved destinations,
- credential handling so secrets are injected at the proxy rather than stored in the sandbox.

The role profiles express the intended egress surface (retrieval API, guardrails, and for the field agent a small set of policy-controlled public research hosts). OpenShell network policy is the enforcement mechanism the overlay expects to carry these rules.

## Secrets Tension

The corpus records a live contradiction: AKS-native Key Vault flows (Workload Identity plus the Key Vault CSI driver, used for the data plane in `manifests/private-connectivity.yaml`) versus gateway-managed credentials, which remain the current NemoClaw/OpenShell pattern on the worker tier. Aligning these into one supported secret path is `blocked` in the tracker and tracked as "Azure-native secret path alignment" in the backlog.

## Agent Memory And State

The overlay pattern mounts ANF volumes for agent state (`/sandbox/state` on `anf-premium-rwo`) and read-only skills or policy bundles (`anf-standard-rox`) per the role profiles. This is an `assumed` overlay pattern, not a turnkey upstream NemoClaw feature; mount, restore, and failure behavior under the worker-tier model still need validation.

## Status Summary

| Item | Status |
|---|---|
| Retrieval-API-only knowledge access | `validated` (design plus service code) |
| Worker-tier bootstrap contract | `assumed` |
| OpenShell egress mediation carrying profile rules | `assumed` |
| Azure-native secret alignment | `blocked` |
| ANF-backed agent memory | `assumed` |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
