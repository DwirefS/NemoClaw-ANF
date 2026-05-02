<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Upstream Sync And Overlay Release Runbook

This runbook describes the practical operating loop for keeping this fork current with NVIDIA NemoClaw while maintaining the enterprise Azure ANF overlay.

## Branch Policy

- `upstream/main`: remote-tracking reference only.
- `vendor/nvidia-main`: local upstream mirror, fast-forward only.
- `main`: enterprise integration branch.
- feature branches: short-lived branches from `main`.

## Initial Setup

The current repo already has the required remotes:

```bash
git remote -v
```

Expected:

```text
origin   https://github.com/DwirefS/NemoClaw-ANF.git
upstream https://github.com/NVIDIA/NemoClaw.git
```

## Standard Upstream Sync

### Step 1: Refresh upstream state

```bash
git fetch upstream
git checkout -B vendor/nvidia-main upstream/main
```

Expected result:

- `vendor/nvidia-main` exactly matches `upstream/main`
- no local product commits exist on the mirror branch

### Step 2: Merge upstream into the enterprise integration branch

```bash
git checkout main
git merge --no-ff vendor/nvidia-main
```

Expected result:

- merge commit records the upstream sync event
- product history stays intact

### Step 3: Resolve conflicts by ownership

Use this rule table:

| Conflict Location | Resolution Rule |
|---|---|
| project-owned overlay paths | Resolve in favor of the product intent. |
| upstream-owned paths with no intentional patch | Remove accidental drift and prefer upstream. |
| controlled-overlap files | Re-apply only the minimal documented patch and update the diff register if needed. |

### Step 4: Validate after merge

Run the checks that correspond to changed areas:

```bash
npm test
npm run typecheck:cli
```

Also validate the incubator package:

- confirm Mermaid sources still represent the intended baseline,
- re-read the diff register for patched upstream files,
- verify any overlay manifests that depend on changed upstream behavior.

## Working On Enterprise Features

For new enterprise work:

```bash
git checkout main
git pull origin main
git checkout -b codex/<feature-name>
```

Rules:

- add new platform code in project-owned overlay paths first,
- use upstream-owned paths only for minimal integration seams,
- record any upstream patch in the diff register before merge.

## Patch Register Workflow

When an upstream-owned file must change:

1. Add or update the entry in `upstream-diff-register.md`.
2. Note the file path, reason, risk, and desired upstream fate.
3. Add tests covering the patched behavior.
4. Keep the patch isolated in a small commit.

## Release Workflow

Every integrated platform release should capture:

- enterprise release version,
- upstream NemoClaw SHA or tag,
- local upstream patch list,
- validated environment matrix,
- release notes for overlay-only changes.

## Suggested Release Record

Record each release in the following form:

```text
Release: enterprise-azure-anf v0.1.0
Upstream base: NVIDIA/NemoClaw @ <sha-or-tag>
Overlay branch: main @ <sha>
Patched upstream files: <count>
Validated matrix: Azure <version>, AKS <version>, ANF <tiering/profile>, PostgreSQL <version>, NIM bundle <version>
```

## Cadence

Recommended cadence:

- light upstream fetch review weekly,
- upstream merge at least monthly,
- emergency upstream sync whenever NVIDIA lands security or runtime fixes relevant to your deployment.

Smaller, frequent merges are safer than rare, massive rebases.
