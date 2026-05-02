<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Program Logbook

This logbook is the running operational record of what has been built, what changed, what was learned, and what conflicts or mismatches were resolved during implementation.

## How To Use This Log

- Append an entry after each meaningful implementation pass.
- Record both code changes and control-surface changes.
- Record mismatches between assumptions and implementation, then note how they were resolved.
- Keep the engineering tracker for status and this logbook for chronology.

## Entries

### 2026-05-01 — Incubator foundation and corpus normalization

Completed:

- created the incubator package under `incubator/enterprise-azure-anf/`
- normalized the user-supplied research corpus into:
  - manifest
  - contradiction graph
  - source map
  - extracted highlights
- created the initial spec set, ADR set, role profiles, manifests, and runbooks
- created the first contributor skills for:
  - corpus navigation
  - architecture
  - deployment
  - productization

Why it mattered:

- this established a stable project-owned overlay surface separate from upstream NemoClaw core
- it also preserved the source lineage and documented early contradictions instead of hiding them in chat

### 2026-05-01 — Upstream sync and fork-plus-overlay governance

Completed:

- defined the fork-plus-overlay repo strategy
- created the local upstream mirror branch model around `vendor/nvidia-main`
- documented upstream-owned, overlay-owned, and controlled-overlap zones
- added runbooks for upstream sync, release flow, adoption, and patch tracking

Why it mattered:

- this made the enterprise work compatible with ongoing NVIDIA upstream sync rather than forcing a hard fork

### 2026-05-01 — Retrieval API first runtime slice

Completed:

- created the project-owned `retrieval API` under `enterprise/services/retrieval-api/`
- added:
  - request and response contracts
  - policy and role profile mapping
  - HTTP server
  - in-memory backend
  - hybrid `pgvector` query planner
- added tests for:
  - health
  - request validation
  - role-aware filtering
  - query-plan generation

Why it mattered:

- this established the core enterprise seam between the agent plane and the RAG plane

### 2026-05-01 — NVIDIA and Azure source-alignment pass

Completed:

- aligned manifests and contracts to official source patterns for:
  - NIM Operator `NIMCache` and `NIMService`
  - NeMo Retriever `release/26.03`
  - Nemotron and reranker model identifiers
  - ANF PostgreSQL-oriented storage-class mount options
- added NIM contract request builders and alignment tests

Why it mattered:

- this reduced drift between the overlay and the official source ecosystems we depend on

### 2026-05-01 — Official component map, observations, and engineering tracker

Completed:

- recorded the official source component map
- recorded observations and considerations from research and implementation
- added the engineering tracker with:
  - `validated`
  - `assumed`
  - `custom-build-required`
  - `blocked`

Why it mattered:

- this made the project status inspectable and reusable across future turns instead of relying on session memory

### 2026-05-01 — Live backend wiring and NIM HTTP clients

Completed:

- added runtime config for `static` versus `pgvector` backend mode
- added backend factory
- added embedding and reranking NIM HTTP clients
- added `pgvector` backend wiring with optional reranking-aware ordering
- added tests for:
  - NIM HTTP clients
  - bootstrap config loading
  - live backend creation
  - reranking-aware backend behavior

Why it mattered:

- this moved the retrieval API beyond a static contract demo into a configurable live-service shape

### 2026-05-01 — Retrieval schema bootstrap and NeMo Retriever ingestion worker

Completed:

- added retrieval schema migration discovery and bootstrap execution
- added package bootstrap script for the retrieval service
- created a project-owned `NeMo Retriever ingestion worker`
- worker package now includes:
  - Dockerfile
  - requirements
  - runtime config
  - PostgreSQL writer
  - documented pipeline in `main.py`
- updated the incubator ingest manifest to use the packaged worker image instead of an inline heredoc script

Why it mattered:

- this replaced manifest-only placeholders with runnable package boundaries for both retrieval bootstrap and ingestion execution

### 2026-05-01 — Program-control layer for future agent work

Completed:

- added a chronological program logbook
- added a dependency-aware delivery backlog
- added explicit change-control and execution rules
- added an execution-control contributor skill for future agent sessions
- wired these surfaces into incubator tests and read paths

Why it mattered:

- this closed the gap between implementation tracking and implementation control
- it also encoded the requirement that future substantial work be plan-first and that removals require explicit user approval

### 2026-05-02 — Public site design and split implementation planning

Completed:

- wrote the public-site design for a project-owned `site/` publishing surface
- locked the decision to keep the public architecture experience outside the upstream NemoClaw `docs/` tree
- defined the repo-root `artifacts/enterprise-azure-anf/` store for visible PNG and PDF assets
- split the next execution wave into two implementation plans:
  - public site and artifact publishing
  - retrieval bootstrap and live-validation continuation

Why it mattered:

- this preserved the upstream-docs boundary while still making the architecture work publicly visible
- it also decomposed the next build phase into smaller executable units instead of blending frontend publishing work with deployment-runtime work

### 2026-05-02 — Public site scaffold, artifact store, and provenance checks

Completed:

- implemented the local `site/` surface with the landing page, deep-dive pages, and artifact links
- added the repo-root `artifacts/enterprise-azure-anf/` store for the visible PNG and PDF assets
- added icon provenance documentation under `site/assets/icons/README.md`
- tightened the site test coverage around the provenance note and the non-affiliation disclaimer

Why it mattered:

- the public architecture surface is now present and reviewable in the repository itself
- the remaining gap is explicit publish automation, which is still not implemented in this workspace

### 2026-05-02 — GitHub Pages publish workflow for the enterprise site

Completed:

- added a dedicated GitHub Pages workflow at `.github/workflows/enterprise-site-pages.yml`
- configured the publish assembly so `site/` becomes the publish root
- copied `artifacts/enterprise-azure-anf/` into the publish output under the same path
- added `.nojekyll` to the assembled publish directory
- added a focused workflow test to guard the required Pages actions and publish inputs

Why it mattered:

- the repository now contains the publish automation needed for the public site and artifact store
- GitHub repository Pages settings may still need a manual switch from branch deploy to GitHub Actions for the workflow to take effect

### 2026-05-02 — Retrieval bootstrap deployment wiring and smoke validation

Completed:

- added the deployment-time retrieval bootstrap job manifest
- aligned the bootstrap job secret key with the retrieval API deployment secret contract
- documented bootstrap sequencing in the retrieval API README and deployment manifest
- added a repo-owned smoke readiness script for:
  - `RETRIEVAL_API_DATABASE_URL`
  - `RETRIEVAL_API_EMBEDDING_URL`
  - `RETRIEVAL_API_RERANKER_URL`
- added focused tests for:
  - bootstrap job manifest presence and contract
  - bootstrap dependency visibility from the retrieval deployment surface
  - smoke readiness script content

Why it mattered:

- the retrieval bootstrap path is now represented both in package code and in the incubator deployment bundle
- the repo can now validate bootstrap prerequisites before a live PostgreSQL validation pass

### 2026-05-02 — Live PostgreSQL verification harness

Completed:

- added a package-owned `verify-live-postgres.mjs` script for the retrieval service
- exposed the verification script through `npm run verify:postgres`
- added an incubator verification job manifest that runs the same package-owned script in-cluster
- documented the live verification step in the retrieval README
- added focused tests for:
  - script content and contract
  - verification job manifest wiring

Why it mattered:

- the repo now has a concrete preflight for the live PostgreSQL path instead of relying only on bootstrap and assumptions
- the remaining gap is no longer “how do we verify the database contract,” but “run this harness against a real deployment”

## Conflict And Resolution Record

Conflict and resolution record for this program:

### Manifest worker packaging versus source-traceability test

Conflict:

- once the inline ingest script was replaced by a packaged worker image, the NVIDIA alignment test no longer saw the NeMo Retriever provenance strings in the manifest

Resolution:

- preserved the packaged worker image
- added source-provenance comments to the ingest manifest so both truths remain visible:
  - packaged deployment surface
  - explicit upstream source lineage

### Worker implementation versus documented pipeline-shape test

Conflict:

- the worker initially passed an embedding endpoint argument directly into `.embed(...)`
- the alignment test expected the documented no-arg `.embed()` chain

Resolution:

- changed the worker pipeline to use `.embed()` in the main flow so it stays consistent with the documented shape being validated

### Placeholder control surfaces versus actual execution needs

Conflict:

- architecture, risk, and implementation status were documented
- but there was no full logbook, dependency-aware backlog, or explicit approval rule for removals

Resolution:

- added this logbook
- added the delivery backlog and dependency map
- added change-control rules
- added a contributor execution-control skill to keep future agent work aligned

### Bootstrap sequencing documentation versus actual package scripts

Conflict:

- the retrieval API README was briefly updated to tell operators to run `npm run build` before `npm run bootstrap`
- but the retrieval package currently executes TypeScript directly with Node strip-types and does not define a build script

Resolution:

- removed the extra build step from the README
- kept the bootstrap instructions aligned to the actual package contract so the deployment guidance remains accurate

### Live PostgreSQL verification runtime contract versus local dependency resolution

Conflict:

- the verification harness needed to use `pg`
- but the missing-DSN failure path still had to work cleanly even if the script is invoked before dependency resolution reaches the `pg` module

Resolution:

- performed the `RETRIEVAL_API_DATABASE_URL` check before loading `pg`
- deferred the `pg` import until after the DSN contract is present so the failure mode stays truthful and operator-friendly
