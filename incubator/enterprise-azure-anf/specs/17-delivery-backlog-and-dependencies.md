<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Delivery Backlog And Dependencies

This backlog tracks what remains, what depends on what, and what should be worked next.

## Status Key

- `done`
- `in-progress`
- `next`
- `later`
- `blocked`

## Delivery Backlog

| Work Item | Status | Depends On | Notes |
|---|---|---|---|
| retrieval API contract and policy surface | `done` | incubator baseline | implemented in project-owned overlay |
| public `site/` scaffold and repo-root artifact store | `done` | approved site design, visible artifact sources | implemented locally; keep outside upstream NemoClaw docs |
| public architecture landing page and deep-dive sections | `done` | site scaffold, artifact store, approved site design | content reflects the hybrid baseline and disclosure rules in the checked-in site |
| GitHub Pages publish workflow | `done` | site scaffold, Pages configuration | implemented in-repo; repository Pages settings may still need a manual switch to GitHub Actions |
| retrieval schema bootstrap job | `done` | retrieval bootstrap runner, PostgreSQL deployment pattern | deployment-time bootstrap job manifest now exists in the incubator bundle |
| retrieval bootstrap readiness smoke validation | `done` | retrieval bootstrap runner | repo-owned readiness script now checks the required bootstrap env contract without touching the live database |
| live PostgreSQL verification harness | `done` | retrieval bootstrap runner, package-owned DSN contract | repo-owned verification script and verification job manifest now exist |
| live PostgreSQL verification against a real deployment | `done` | bootstrap runner, verification harness, real database, migrations | validated 2026-06-12 against PostgreSQL 16 plus pgvector 0.8.2, locally and in the CI service-container workflow; AKS-plus-ANF validation tracked separately below |
| end-to-end retrieval stack validation in CI | `done` | e2e local stack script, pgvector service container | `.github/workflows/enterprise-retrieval-e2e.yaml` runs bootstrap, verification, and the role/ACL e2e on every enterprise change |
| missing incubator spec reconstruction (00-14, 18) | `done` | corpus derivatives, ADRs, control surfaces | original files were swallowed by a generic `specs/` gitignore rule; reconstructed with provenance notes and the gitignore rule scoped |
| repo path portability (author-machine absolute paths) | `done` | none | incubator docs and contributor skills now use repo-relative paths; corpus manifest keeps historical capture paths as annotated provenance |
| cluster validation on AKS plus ANF | `next` | Azure subscription, ANF volumes, AKS cluster, NIM deployments | the same harness and e2e script should be re-run on the target platform |
| live embedding NIM validation | `next` | deployed embedding NIM, retrieval service | mocked contract is tested; live compatibility still needed |
| live reranker NIM validation | `next` | deployed reranker NIM, retrieval service | backend can consume reranking, but live validation is pending |
| retrieval result packaging and evidence shape hardening | `later` | live retrieval path | will matter once agent grounding payload format stabilizes |
| NeMo Retriever ingestion worker package | `done` | worker package boundary | implemented as repo-owned package |
| live NeMo Retriever validation | `next` | worker package, sample corpora, live NIM endpoints | output normalization still needs real-data proof |
| document chunk normalization against real Retriever outputs | `next` | live NeMo Retriever validation | current normalization is intentionally conservative |
| duplicate-ingestion protection | `done` | stable writer contract | content-addressed chunk ids (SHA-256 of source and content) landed 2026-06-12 in the PostgreSQL writer |
| PostgreSQL benchmark and ANF storage tuning | `next` | live DB path, ANF volumes | validates storage-class assumptions |
| ACL-aware retrieval filtering | `in-progress` | identity model, permission ingestion, metadata model | metadata model and retrieval-time enforcement landed 2026-06-12 and are e2e-validated; identity-provider mapping remains the open half |
| identity mapping for asserted principals | `blocked` | Azure identity strategy (Entra groups or workload identity) | the retrieval API currently trusts the caller's asserted principals; an authenticating gateway must own this mapping |
| permission capture during ingestion | `in-progress` | ACL-aware retrieval design | the writer persists `acl_principals` supplied in chunk metadata; automatic capture from ANF share ACLs is still open |
| Azure-native secret path alignment | `blocked` | worker tier bootstrap decision, AKS secret model | current design is partial |
| agent memory and restore validation on ANF | `later` | worker tier runtime hardening | not yet exercised against real runtime state |
| full AKS-hosted NemoClaw/OpenShell experiment | `blocked` | upstream maturity, deployment strategy | not part of supported baseline |

## Dependency Notes

Dependency notes for this backlog:

### Retrieval Path

- live PostgreSQL verification depends on:
  - `bootstrap.ts`
  - `migrations.ts`
  - `retrieval-bootstrap-job.yaml`
  - `retrieval-postgres-verify-job.yaml`
  - `scripts/smoke-bootstrap.mjs`
  - `scripts/verify-live-postgres.mjs`
  - a real database deployment
- live NIM validation depends on:
  - deployed `NIMService` instances
  - stable network routing
  - cluster secrets and endpoint config

### Public Site Path

- the visible artifact store depends on:
  - copying the approved PNG boards and PDF into project-owned paths
- the public site depends on:
  - the approved `site/` boundary
  - source material from incubator specs
  - explicit disclosure of validated versus target versus custom-build-required states
- the checked-in local site surface now exists, and the dedicated GitHub Pages publish workflow is now in-repo
- if Pages is still configured for branch deploy, the repository settings must be switched to GitHub Actions before the workflow can publish

### Ingestion Path

- live NeMo Retriever validation depends on:
  - packaged worker image
  - mounted ANF documents
  - parse and embedding endpoints
  - PostgreSQL write access
- duplicate-ingestion protection should wait until the output normalization contract is better proven

### Security Path

- permission capture during ingestion is a prerequisite for ACL-aware retrieval filtering
- ACL-aware retrieval filtering is a prerequisite for enterprise-safe restricted grounding

## Recommended Next Sequence

1. validate the ingestion worker against sample corpora and real Retriever output shapes (nv-ingest `release/26.1.2` upgrade included)
2. validate live embedding and reranker NIM compatibility on a GPU-backed deployment
3. design identity mapping for asserted principals and automatic ACL capture from ANF share permissions
4. re-run the bootstrap, verification, and e2e harness on the target AKS plus ANF deployment
5. benchmark PostgreSQL on ANF tiers (separate WAL and data volumes, hard NFS mounts) and tune the storage assumptions
6. wire NeMo Guardrails and OpenTelemetry GenAI instrumentation into the retrieval path

## NemoMaxxing Wave Additions (2026-06-12)

| Work Item | Status | Depends On | Notes |
|---|---|---|---|
| console UI with grounded chat and ACL inspector | `done` | retrieval API, ACL filtering | live e2e validated locally and in CI |
| deployable Azure infrastructure tree (Bicep, k8s, scripts) | `done` | incubator manifests, spec 08/09 | structurally tested; cloud application still pending |
| nemomaxxing agent skills | `done` | deploy tree, console, retrieval harnesses | four skills plus guide integration and tests |
| first real Azure subscription deployment | `next` | deploy tree, GPU quota, NGC key | this run is the validation event for everything marked assumed |
| live Nemotron/Gemma chat through the console | `next` | deployed NIMService or vLLM/SGLang endpoints | console already speaks the OpenAI-compatible contract |
| authenticating gateway for principals (Entra ID) | `blocked` | identity strategy | precondition for multi-user exposure of console and retrieval API |
