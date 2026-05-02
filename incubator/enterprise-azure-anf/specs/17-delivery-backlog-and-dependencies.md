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
| live PostgreSQL verification against a real deployment | `next` | bootstrap runner, verification harness, cluster database, migrations | current path is implemented but not cluster-validated |
| live embedding NIM validation | `next` | deployed embedding NIM, retrieval service | mocked contract is tested; live compatibility still needed |
| live reranker NIM validation | `next` | deployed reranker NIM, retrieval service | backend can consume reranking, but live validation is pending |
| retrieval result packaging and evidence shape hardening | `later` | live retrieval path | will matter once agent grounding payload format stabilizes |
| NeMo Retriever ingestion worker package | `done` | worker package boundary | implemented as repo-owned package |
| live NeMo Retriever validation | `next` | worker package, sample corpora, live NIM endpoints | output normalization still needs real-data proof |
| document chunk normalization against real Retriever outputs | `next` | live NeMo Retriever validation | current normalization is intentionally conservative |
| duplicate-ingestion protection | `later` | stable writer contract | likely content-hash or source-version-based |
| PostgreSQL benchmark and ANF storage tuning | `next` | live DB path, ANF volumes | validates storage-class assumptions |
| ACL-aware retrieval filtering | `blocked` | identity model, permission ingestion, metadata model | highest enterprise grounding risk |
| permission capture during ingestion | `blocked` | ACL-aware retrieval design | depends on source ACL strategy |
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

1. run the live PostgreSQL verification harness against the incubator database manifest and bootstrap job flow
2. validate the ingestion worker against sample corpora and real Retriever output shapes
3. validate live embedding and reranker NIM compatibility
4. design permission capture and ACL-aware retrieval as the next security-critical milestone
5. benchmark PostgreSQL on ANF tiers and tune the storage assumptions
