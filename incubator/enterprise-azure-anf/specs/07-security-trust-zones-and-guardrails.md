<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Security, Trust Zones, And Guardrails

This spec defines the trust model: field-agent and vault-agent role separation (ADR-005), the bridge between them, guardrails placement, and the audit posture. The roles are profiles and policy contracts applied to the NemoClaw/OpenShell runtime — they are **not** new top-level agent runtimes.

## Trust Zones

| Zone | Role | Grounding Mode | Data Classes |
|---|---|---|---|
| Low trust | `field-agent` | `sanitized-only` | `public`, `internal-sanitized`, `derived-grounding-evidence`; denies raw PII, finance-sensitive, restricted IP |
| High trust | `vault-agent` | `restricted-enterprise` | adds `internal`, `pii-controlled`, `finance-sensitive`, `intellectual-property-restricted`; denies unrestricted public internet write |

Profile sources: `incubator/enterprise-azure-anf/profiles/field-agent.yaml` and `vault-agent.yaml`. The retrieval API enforces the same split in code (`enterprise/services/retrieval-api/src/profiles.ts`):

- field-agent: collections `enterprise-public`, `enterprise-internal-sanitized`; max 12 results,
- vault-agent: adds `enterprise-sensitive`, `enterprise-regulated`; max 20 results.

Requests for disallowed collections are filtered, and the denied collections are reported back in the policy summary rather than silently dropped.

## The Field/Vault Bridge

`profiles/shared-policy-contract.yaml` defines the A2A bridge:

- mutual-TLS authentication with caller identity required,
- only `field-agent` may call, only `vault-agent` may be targeted,
- required request attributes: `request-id`, `caller-role`, `user-identity`, `classification-intent`,
- denied actions: arbitrary tool execution, raw filesystem browse, direct secret requests,
- response masking is required (PII, secrets, finance classifiers), grounding evidence IDs and classification are included, and a raw vault response may never leave the high-trust zone.

The flow matches `diagrams/multiagent_security.mmd`: field agent requests cross the guardrails-mediated A2A gateway, vault responses return scrubbed.

## Guardrails

Guardrails run as a service in the data plane (`manifests/guardrails-service.yaml`, NeMo Guardrails image with a mounted Colang config). The role profiles declare the rails:

| Role | Input Rails | Output Rails |
|---|---|---|
| field-agent | jailbreak-detection, pii-request-detection, topic-boundary | pii-masking, grounding-required, safe-completion |
| vault-agent | jailbreak-detection, privileged-action-detection, sensitive-topic-routing | pii-review, source-attribution-required, bridge-scrubbing-required |

The checked-in Colang config is a placeholder flow; production rails are `custom-build-required`.

## Network Enforcement

- Inference namespace: ingress and egress restricted to `rag` and `guardrails` namespaces (`manifests/private-connectivity.yaml`).
- Retrieval API: ingress only from `worker-tier` and `ingestion` namespaces (`manifests/retrieval-api.yaml`).
- Secrets: Azure Key Vault CSI `SecretProviderClass` with VM managed identity for the data plane.

## Audit Requirements

Both profiles require logging of prompt and response metadata, retrieval identifiers, and policy events, with credential material redacted from all logs. The bridge contract emits `bridge-request`, `bridge-response`, `guardrail-block`, and `operator-override` events. Escalation behavior is explicit: field agents route sensitive requests through the bridge only after guardrail approval; policy violations block the response and require operator review (vault-agent violations quarantine the run context).

## The Open Gap: ACL-Aware Retrieval

Trust zones bound *which collections* a role can see, but they do not yet bound *which principals* can see which documents. ACL-aware retrieval filtering and permission capture during ingestion are `blocked` and are the highest enterprise grounding risk (spec 11). Until they land, restricted corpora must not be exposed beyond the coarse collection model.

## Status Summary

| Item | Status |
|---|---|
| Role profiles and policy contract | `validated` (design plus retrieval-code enforcement) |
| Bridge enforcement at runtime | `assumed` (contract is a design input, not runtime-enforced schema) |
| Production guardrail rails | `custom-build-required` |
| ACL-aware retrieval | `blocked` |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
