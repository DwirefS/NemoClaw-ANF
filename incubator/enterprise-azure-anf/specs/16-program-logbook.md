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

### 2026-06-12 — Project review, spec reconstruction, and first live end-to-end validation

Completed:

- reviewed the full repository with fresh eyes and recorded the findings in `incubator/enterprise-azure-anf/plans/2026-06-12-project-review-and-enhancement-plan.md`
- discovered that specs 00-14 and 18 were never committed because a generic `specs/` rule in the root `.gitignore` silently swallowed them; scoped the rule with a negation and reconstructed all sixteen files from in-repo sources with explicit provenance notes
- replaced the author-machine absolute paths (`/Users/dwirefs/...`) across incubator docs and contributor skills with repo-relative paths; annotated the corpus manifest paths as historical provenance
- ran the retrieval bootstrap, verification harness, and a new end-to-end stack validation against a real PostgreSQL 16 deployment with pgvector 0.8.2 for the first time
- fixed the four live-path defects this exposed (recorded below) and landed ACL-aware retrieval filtering, migration ledger tracking, duplicate-ingestion protection, and a CI e2e workflow
- brought the retrieval service under the root Biome lint and format scope

Why it mattered:

- the retrieval path moved from "implemented but never executed" to "proven end to end against a live database, locally and in CI"
- the highest-risk blocked item (ACL-aware retrieval) now has a working metadata model and enforcement path
- the program's written record (specs, skills, corpus) is portable and complete for the first time

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

### Committed spec set versus gitignore scratch rule

Conflict:

- the incubator README, skills, and tests all referenced a nineteen-file spec set, but only specs 15-17 existed in the repository
- the root `.gitignore` contains a generic `specs/` scratch rule that silently excluded the incubator spec directory, so the original files were lost on the author's machine

Resolution:

- added a scoped negation (`!incubator/enterprise-azure-anf/specs/`) so the incubator specs are repo-owned
- reconstructed specs 00-14 and 18 from the corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, site content, and control surfaces, each with an explicit provenance section

### Declared embedding dimension versus default model and index limits

Conflict:

- the schema declared `embedding vector(3072)` while the default embedding model (`nvidia/nv-embedqa-e5-v5`) emits 1024 dimensions
- pgvector rejects HNSW indexes on `vector` columns above 2000 dimensions, so the migration failed against a real database (`hnswbuild.c` InitBuildState error captured live)

Resolution:

- changed the column to `vector(1024)` to match the default model and documented the model-dimension coupling and the `halfvec` strategy required for larger models

### Documented entrypoints versus strip-types module resolution

Conflict:

- `npm start` and `npm run bootstrap` run TypeScript through `node --experimental-strip-types`, which requires explicit `.ts` extensions on relative imports
- every relative import in the package was extensionless, so the documented entrypoints had never been runnable; only bundler-based tests passed

Resolution:

- added explicit `.ts` extensions to all relative imports and validated both entrypoints against the live database

### Parameter encoding versus pgvector literal form

Conflict:

- the TypeScript backend passed the query embedding as a JavaScript array and the Python writer passed a list, which node-postgres and psycopg encode as PostgreSQL array literals (`{...}`); the `vector` type requires the `[...]` literal form

Resolution:

- introduced `toVectorLiteral` with a `$1::vector` cast in the query plan, and JSON-encoded embeddings with a `%s::vector` cast in the ingestion writer

### Verification harness index names versus migration index names

Conflict:

- `verify-live-postgres.mjs` checked for `document_chunks_embedding_idx` and `document_chunks_fts_idx`, but the migration creates `document_chunks_embedding_hnsw_idx` and `document_chunks_tsv_gin_idx`, so the harness could never pass

Resolution:

- aligned the harness to the real index names and added the new ACL index to the expected set

### 2026-06-12 — NemoMaxxing deployable stack, console, and agent skills

Completed:

- built the NemoMaxxing console (`enterprise/services/console/`): grounded chat through the retrieval boundary, retrieval inspector exposing policy and ACL decisions, dependency-free server, unit tests, and a live e2e validated against the real PostgreSQL plus pgvector stack
- created the deployable infrastructure tree (`enterprise/deploy/`): Bicep for VNet, ANF account/pools/volumes, AKS GPU cluster, and Key Vault; numbered Kubernetes manifests for the data plane, RAG NIMs, Nemotron and multi-engine Gemma inference, nv-ingest, retrieval API, console, and worker tier; staged deploy and validation scripts
- authored four `nemomaxxing-*` agent skills so an agent given this repository can deploy and operate the platform end to end, and added them to the skills guide
- extended the CI e2e workflow to validate the console against the pgvector service container
- recorded the wave plan in `incubator/enterprise-azure-anf/plans/2026-06-12-nemomaxxing-deployable-stack.md`

Why it mattered:

- the overlay now has a human-facing surface that makes role and ACL enforcement visible instead of implied
- the path from "validated locally" to "running on Azure" is now encoded as reviewable infrastructure code and agent-executable skills rather than tribal knowledge
- the honest boundary is explicit: cloud assets are `assumed` until the first real subscription deployment, which must be logged as the next validation event

### 2026-07-03 — Secure gateway, MCP bridge, and production hardening

Completed:

- built the secure gateway (`enterprise/services/gateway/`) realizing the whitepaper's policy-enforcement seam: bearer authentication (static tokens plus RS256 JWT against a JWKS endpoint for Entra ID-style identity), identity-derived principals (body-supplied principals are discarded, closing the trust gap that had been the top blocked security item), redaction and masking of sanitized-only responses, JSONL audit trail carrying query hashes instead of raw queries, per-subject rate limiting, and Prometheus metrics
- built the MCP-to-ANF bridge (`enterprise/services/mcp-bridge/`) realizing the whitepaper's "Universal Translator": a dependency-free stdio MCP server exposing `retrieval_search` and `retrieval_health` tools over the gateway, with principals deliberately excluded from tool arguments
- hardened the retrieval API for production: liveness (`/healthz`) split from readiness (`/readyz` with backend probe), request body caps, and graceful SIGTERM draining across all services
- wired the console through the gateway (`CONSOLE_RETRIEVAL_TOKEN`), added the gateway deployment manifest with a NetworkPolicy that makes the retrieval API reachable only from the gateway, gateway secret creation in the cluster bootstrap script, and the stage-55 apply step
- validated everything live against real PostgreSQL plus pgvector: nine gateway e2e checks (401/403 paths, identity-derived ACL unlock with no principals in the body, anti-escalation, redaction of emails and phone numbers, rate limiting, audit integrity, metrics) and five MCP bridge e2e checks; CI now runs retrieval, console, gateway, and bridge e2e suites against the pgvector service container

Why it mattered:

- the two largest promised-but-missing architecture links from the whitepaper (secure gateway, MCP bridge) now exist as tested code instead of diagrams
- ACL enforcement became authenticated enforcement: who may assert which principals is now decided by verified identity, not by the caller
- the platform's human surface (console), agent surface (MCP), and service surface (HTTP) all pass through one audited, redacting, rate-limited boundary

### 2026-07-03 — Fable review report and technology foresight

Completed:

- authored the comprehensive review-and-handover document at `incubator/enterprise-azure-anf/reviews/2026-07-03-fable-review-report-and-enhancements.md`: project philosophy, repository map, review findings, the three build waves with what/why/how/where, architecture inputs and invariants, a July-2026 trend-grounded feature roadmap, a prioritized resume-work plan, and the validation evidence ledger
- refreshed the technology research underpinning the roadmap: NVIDIA Dynamo/NIXL KV-cache offload to networked storage and NetApp's AI Data Engine (the ANF-as-inference-memory opportunity), the MCP 2026-07-28 authorization spec (OAuth 2.1 resource servers), A2A 1.0 under the Linux Foundation, agent-memory vendor landscape versus ANF snapshot-as-memory, EU AI Act enforcement timeline, Azure confidential H100 GA, and the benchmark-gated case for keeping pgvector over GPU ANN (ADR-003 upheld)

Why it mattered:

- the project owner is resuming development after a pause; this report is the single re-entry point that connects the whitepaper's philosophy, the current validated state, and the next quarter of work in dependency order
