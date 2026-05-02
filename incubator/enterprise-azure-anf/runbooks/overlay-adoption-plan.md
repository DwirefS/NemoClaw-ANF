<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Overlay Adoption Plan

This plan turns the repo from a plain NemoClaw fork into a maintained product branch with a clean enterprise overlay.

## Goal

Keep NVIDIA NemoClaw syncable from `upstream/main` while building the Azure ANF, AKS, NIM, PostgreSQL, and enterprise-governance stack around it.

## Target End State

- Upstream NemoClaw remains recognizable and mostly untouched.
- Enterprise features live in project-owned overlay paths.
- Integration happens through retrieval APIs, manifests, policies, adapters, and runbooks.
- Local patches to upstream-owned code are rare, tested, and logged.
- Every enterprise release identifies both the upstream core version and the overlay version.

## Phase 1: Lock The Governance Model

Complete when:

- `vendor/nvidia-main` exists and tracks `upstream/main`
- the repo strategy spec is committed
- the upstream diff register exists
- contributors know the ownership model

Status in this repo now:

- complete for the branch model,
- complete for the governance docs,
- pending broader contributor enablement through incubator skills and onboarding docs.

## Phase 2: Keep New Work Out Of Upstream-owned Paths

For every new enterprise deliverable, choose a project-owned location first.

Examples:

- retrieval service code under a future `enterprise/services/` path
- deployment assets under a future `enterprise/deploy/` path
- operator and architecture docs under `incubator/enterprise-azure-anf/`
- role profiles and policy contracts under incubator-owned paths first

Exit criteria:

- no new enterprise-only features land inside `src/`, `nemoclaw/`, or `nemoclaw-blueprint/` unless documented as controlled overlap.

## Phase 3: Define Stable Integration Seams

Create explicit boundaries between NemoClaw core and the enterprise overlay.

Required seams:

- internal retrieval API between the agent runtime and the RAG or data plane
- environment-driven configuration for enterprise endpoints and policies
- deployment-layer overlays for AKS, ANF, PostgreSQL, NIMs, and observability
- contributor skills that point to the incubator specs instead of raw research

Exit criteria:

- enterprise components can evolve without repeatedly editing NemoClaw internals.

## Phase 4: Minimize And Track Unavoidable Patches

When an upstream-owned file must change:

- isolate the patch,
- add tests,
- register it in `upstream-diff-register.md`,
- review whether the patch should later be proposed upstream.

Exit criteria:

- every intentional upstream patch is visible in one place,
- upstream merges are no longer blocked by hidden local drift.

## Phase 5: Establish Release Discipline

Adopt an integrated release record containing:

- upstream NemoClaw SHA or tag,
- overlay version,
- local patch count,
- validated Azure and ANF deployment matrix,
- NIM and PostgreSQL compatibility notes.

Exit criteria:

- a release can be reconstructed without guessing which upstream base it came from.

## Phase 6: Reassess Repo Boundaries Periodically

Review the model every few release cycles.

Stay in the fork when:

- most custom work is additive,
- patches to upstream remain low,
- the enterprise stack still depends tightly on NemoClaw internals.

Start planning a separate product repo when:

- overlay code dominates the repository,
- the platform has multiple independent services and teams,
- upstream patch count grows steadily,
- the fork becomes more product than core runtime.

## Working Rules For Contributors

Use this short checklist before opening a PR:

1. Is this change project-owned overlay work or an upstream-core patch?
2. If it is overlay work, can it stay outside upstream-owned paths?
3. If it touches upstream-owned paths, is the patch logged and tested?
4. Does the PR make upstream sync easier, harder, or ambiguous?
5. Could this be moved to an adapter, manifest, or sibling service instead?

## Recommended Next Moves

1. Finish the incubator spec set and contributor skills.
2. Create project-owned locations for the enterprise retrieval service and deployment assets.
3. Keep the first implementation wave outside NemoClaw internals unless a seam is truly missing.
4. Use the diff register from the first unavoidable upstream patch onward.
