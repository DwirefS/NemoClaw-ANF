<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Change Control And Execution Rules

These rules govern how any contributor or agent session continues implementation work in the Enterprise Azure ANF overlay. They exist because earlier passes showed that architecture, risk, and status documentation alone do not prevent destructive or untracked changes. They are paired with the contributor skill at `.agents/skills/nemoclaw-contributor-enterprise-azure-anf-execution-control/SKILL.md` and are asserted by `test/enterprise-program-control.test.ts`.

## Scope

These rules apply to:

- the incubator package under `incubator/enterprise-azure-anf/`,
- the enterprise overlay code under `enterprise/`,
- the public site and artifact store under `site/` and `artifacts/`,
- any controlled-overlap change to upstream-owned NemoClaw paths.

## Required Behaviors

- Write or update a plan before substantial execution. Plans live under `incubator/enterprise-azure-anf/plans/` and decompose the work into reviewable tasks before code changes start.
- Do not remove, delete, or destructively replace repo files, package surfaces, manifests, or incubator assets without obtaining explicit user approval first.
- For any such removal or destructive replacement, obtain explicit user approval first. A better package boundary existing now is not, by itself, approval to delete the placeholder it replaces.
- After each implementation pass, update the engineering tracker, the program logbook, and the delivery backlog if the work changed project status.
- Record conflicts and resolutions in the program logbook instead of hiding them in a chat-only explanation.

## Read Order Before Executing

1. `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` for current status.
2. `incubator/enterprise-azure-anf/specs/16-program-logbook.md` for chronology and prior conflicts.
3. `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md` for dependency-aware next steps.
4. This document for the execution rules.
5. `incubator/enterprise-azure-anf/specs/12-repo-strategy-and-upstream-sync.md` before touching anything near upstream-owned paths.

## Change Classes

| Class | Examples | Required Control |
|---|---|---|
| Additive overlay work | New service code, new manifests, new specs | Plan first; update control surfaces after |
| Status-changing work | Anything that moves a tracker item between `validated`, `assumed`, `custom-build-required`, `blocked` | Update tracker, logbook, and backlog in the same pass |
| Removal or destructive replacement | Deleting files, replacing package surfaces, rewriting manifests in place | Explicit user approval before execution, then a logbook entry |
| Controlled-overlap patch | Any edit to an upstream-owned path | Diff register entry, isolated commit, tests |

## Execution Discipline

- Keep the engineering tracker for status and the program logbook for chronology; one is not a substitute for the other.
- Keep statuses honest. Do not mark an item `validated` on the strength of mocked tests when the backlog says live validation is still `next`.
- Keep changes inside overlay-owned zones unless a seam is genuinely missing; spec 12 defines the zones.
- Keep each conflict-and-resolution pair in the logbook so future sessions inherit the lesson, not just the outcome.

## Approval Rule In Practice

Approval for a removal or destructive replacement must be explicit and specific: name the files or surfaces to be removed, state why, and get the user's confirmation before executing. Approval for a plan that mentions a removal in passing does not count. When in doubt, keep the old surface in place alongside the new one and ask.

## Common Mistakes To Avoid

- Implementing new work without updating the backlog or logbook.
- Deleting placeholder work without approval because a better package boundary now exists.
- Treating the engineering tracker as a substitute for the chronological program logbook.
- Letting public-site or spec claims drift ahead of tracker status.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17) — primarily the execution-control contributor skill, which preserved these rules verbatim — because the original spec files were never committed to this repository.
