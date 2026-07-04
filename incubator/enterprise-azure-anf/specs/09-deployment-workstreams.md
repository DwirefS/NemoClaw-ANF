<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Deployment Workstreams

This spec decomposes deployment into ordered workstreams. Each workstream names its incubator assets and its current status. All assets are examples that evolve inside the incubator before any official deployment story is published.

## Workstream Overview

| # | Workstream | Key Assets | Status |
|---|---|---|---|
| 1 | Storage foundation | `manifests/trident-backend-anf.yaml`, `manifests/storageclasses-anf.yaml` | `assumed` |
| 2 | Database | `manifests/postgresql-pgvector-statefulset.yaml` | `assumed` |
| 3 | Retrieval schema bootstrap | `manifests/retrieval-bootstrap-job.yaml`, `scripts/smoke-bootstrap.mjs`, `scripts/verify-live-postgres.mjs`, `manifests/retrieval-postgres-verify-job.yaml` | `validated` surfaces, `assumed` live |
| 4 | Inference NIMs | `manifests/nim-services.yaml` (`NIMCache` plus four `NIMService` resources) | `validated` pattern, `assumed` live |
| 5 | Guardrails | `manifests/guardrails-service.yaml` | `custom-build-required` (placeholder rails) |
| 6 | Retrieval API | `manifests/retrieval-api.yaml`, `enterprise/services/retrieval-api/` | `validated` code, `assumed` live |
| 7 | Ingestion | `manifests/nv-ingest-trigger.yaml`, `enterprise/workers/nemo-retriever-ingest/` | `assumed` |
| 8 | Worker tier | `manifests/nemoclaw-worker-tier.yaml` | `assumed` |
| 9 | Private connectivity and secrets | `manifests/private-connectivity.yaml` | `assumed` |
| 10 | Public site publishing | `site/`, `artifacts/enterprise-azure-anf/`, `.github/workflows/enterprise-site-pages.yml` | `validated` |

All `manifests/` paths above are under `incubator/enterprise-azure-anf/`.

## Sequencing

The deployment order encodes hard dependencies:

1. **Storage first.** Trident backend, then storage classes. Everything downstream claims ANF-backed PVCs.
2. **Database.** PostgreSQL StatefulSet with separate data and WAL volumes on `anf-postgres-rwo`.
3. **Bootstrap before service.** Run the `retrieval-bootstrap` job (applies `sql/` migrations via `npm run bootstrap`) before the retrieval API deployment targets a fresh database. The deployment carries the `nemo.claw.ai/bootstrap-job: retrieval-bootstrap` annotation to keep this visible. Run `retrieval-postgres-verify` after bootstrap and before enabling live retrieval.
4. **Inference.** `NIMCache` populates the shared ANF-backed model cache, then `NIMService` resources for the Nemotron LLM, embedder, reranker, and parse services.
5. **Guardrails.** Deploy with the mounted Colang config.
6. **Retrieval API.** Two replicas with the ingress network policy limiting callers to the `worker-tier` and `ingestion` namespaces.
7. **Ingestion.** The `nv-ingest-reconcile` CronJob (every 10 minutes) reads the document PVC and writes through the packaged worker image.
8. **Worker tier.** Cloud-init bootstrap with the enterprise env contract, only after the retrieval API and guardrails endpoints resolve.
9. **Edge and secrets.** Application Gateway ingress, inference network policy, and the Key Vault `SecretProviderClass`.

## Secret Contract

One secret key threads the database workstreams together: `retrieval-api-secrets/postgres-dsn` feeds `POSTGRES_DSN` for the service and `RETRIEVAL_API_DATABASE_URL` for the bootstrap and verify jobs. The ingestion namespace uses its own `ingestion-secrets/postgres-dsn`. Key Vault delivery to the worker tier is part of the `blocked` Azure-native secret alignment item.

## Image Boundaries

| Image | Built From |
|---|---|
| `retrieval-api` | `enterprise/services/retrieval-api/Dockerfile` |
| `nemo-retriever-ingest` | `enterprise/workers/nemo-retriever-ingest/Dockerfile` |

Manifests reference these project-owned images directly; no inline heredoc scripts remain in the deployment bundle (resolved conflict in the program logbook).

## Operational Loops

- Ingestion operations: `incubator/enterprise-azure-anf/runbooks/ingestion-operations.md` (detect, parse, chunk and embed, write, validate visibility; watch duplicates, parse failures, embedding timeouts, backlog growth, unauthorized ingestion).
- Upstream sync and release: `runbooks/upstream-sync-and-overlay-release.md`.
- DR: `runbooks/disaster-recovery-and-rollback.md`.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
