<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Repo Strategy And Upstream Sync

This repo is a fork of NVIDIA NemoClaw carrying an enterprise overlay. The strategy keeps upstream syncable while the overlay grows, instead of drifting into a hard fork.

## Branch Model

| Branch | Role |
|---|---|
| `upstream/main` | Remote-tracking reference only |
| `vendor/nvidia-main` | Local upstream mirror, fast-forward only; no local product commits ever land here |
| `main` | Enterprise integration branch |
| feature branches | Short-lived branches from `main` |

The operating loop is in `incubator/enterprise-azure-anf/runbooks/upstream-sync-and-overlay-release.md`: fetch upstream, reset `vendor/nvidia-main` to `upstream/main`, then `git merge --no-ff vendor/nvidia-main` into `main` so each sync event is a visible merge commit.

## Ownership Zones

| Zone | Paths | Rule |
|---|---|---|
| Overlay-owned | `enterprise/`, `incubator/`, `site/`, `artifacts/` | Resolve conflicts in favor of product intent; upstream never owns these |
| Upstream-owned | `src/`, `bin/`, `nemoclaw/`, `nemoclaw-blueprint/`, `docs/`, `scripts/`, `test/` (core), `.agents/skills/nemoclaw-user-*` | Prefer upstream; remove accidental drift |
| Controlled overlap | Any upstream-owned file with an intentional patch | Re-apply only the minimal documented patch; entry required in the diff register |

New enterprise features must choose a project-owned location first. No new enterprise-only feature lands inside `src/`, `nemoclaw/`, or `nemoclaw-blueprint/` unless documented as controlled overlap.

## Patch Register

`incubator/enterprise-azure-anf/runbooks/upstream-diff-register.md` tracks every intentional upstream-owned change with status, files, reason, business need, conflict risk, tests, upstream fate, and removal trigger. Current state: **no intentional upstream patches are registered.** The register is reviewed on every upstream merge and every release.

## Integration Seams

The overlay integrates through stable seams rather than core edits (per the overlay adoption plan):

- the internal retrieval API between the agent runtime and the RAG plane,
- environment-driven configuration for enterprise endpoints and policies,
- deployment-layer overlays for AKS, ANF, PostgreSQL, NIMs, and observability,
- contributor skills pointing at incubator specs instead of raw research.

## Post-Merge Validation

After each upstream merge: run `npm test` and `npm run typecheck:cli`, confirm Mermaid sources still represent the intended baseline, re-read the diff register, and verify overlay manifests that depend on changed upstream behavior.

## Release Discipline

Every integrated release records: enterprise release version, upstream NemoClaw SHA or tag, the local upstream patch list, the validated environment matrix (Azure, AKS, ANF tiering, PostgreSQL, NIM bundle), and overlay-only release notes. A release must be reconstructible without guessing its upstream base.

## Cadence

- Light upstream fetch review weekly.
- Upstream merge at least monthly.
- Emergency sync whenever NVIDIA lands security or runtime fixes relevant to deployments.

Smaller, frequent merges are safer than rare, massive rebases.

## Boundary Reassessment

Review the model every few release cycles. Stay in the fork while custom work is mostly additive and the upstream patch count stays low. Start planning a separate product repo if overlay code dominates, the platform splits across independent teams, or the patch count grows steadily.

## Status

| Item | Status |
|---|---|
| Branch model and governance docs | `validated` |
| Zero registered upstream patches | `validated` |
| Contributor enablement beyond skills | pending |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
