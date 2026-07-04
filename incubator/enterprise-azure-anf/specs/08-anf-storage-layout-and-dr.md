<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ANF Storage Layout And Disaster Recovery

Azure NetApp Files is the unified persistence substrate for the platform. This spec records the volume layout, the Kubernetes storage plumbing, and the recovery model.

## Volume Layout

The canonical layout follows `incubator/enterprise-azure-anf/diagrams/anf_roles.mmd`:

| Volume | Purpose | Tier | Protocol | Access | Consumer |
|---|---|---|---|---|---|
| 1 | Document repository | Standard/Premium | NFSv4.1 | RWX | NeMo Retriever ingest pipeline |
| 2 | PostgreSQL data | Ultra | NFSv4.1 | RWO | PostgreSQL StatefulSet |
| 3 | PostgreSQL WAL | Ultra | NFSv4.1 | RWO | PostgreSQL StatefulSet |
| 4 | NIMCache (model weights) | Ultra | NFSv4.1 | RWX | All NIM pods |
| 5 | Agent memory | Premium | NFSv4.1 | RWO per agent | NemoClaw worker tier |
| 6 | Guardrails config | Standard | NFSv4.1 | ROX | NeMo Guardrails |
| 7 | Snapshot archive | Standard (cool access) | NFSv4.1 | — | Backup/DR jobs |

## Kubernetes Plumbing

- `manifests/trident-backend-anf.yaml`: Astra Trident `TridentBackendConfig` for the `azure-netapp-files` driver, with managed identity, a delegated ANF subnet, and Premium plus Ultra capacity pools.
- `manifests/storageclasses-anf.yaml`: storage classes by service level (`anf-standard-rwx`, `anf-premium-rwo`, `anf-ultra-rwx`, `anf-postgres-rwo`), all mounting `vers=4.1,hard,nconnect=8`; the PostgreSQL class adds `rsize=65536,wsize=65536`.
- `manifests/postgresql-pgvector-statefulset.yaml`: separate `pgdata` (4Ti) and `pgwal` (1Ti) claims on `anf-postgres-rwo`.

PostgreSQL-on-NFS practice the layout encodes: `hard` mounts are required for correctness, and separating WAL from data onto distinct volumes allows different service levels and isolates write-ahead throughput. The performance profile is `assumed` until the benchmark pass in spec 10 runs on real ANF tiers.

## ANF Data-Management Features In Use

| Feature | Applied To | Purpose |
|---|---|---|
| Redirect-on-write snapshots (up to 255/volume) | DB data, WAL, agent memory | Instant, low-overhead recovery points |
| SnapMirror cross-region replication | DB data, agent memory | DR over the private backbone |
| Cool access auto-tiering | Document repository, snapshot archive | Cost control for infrequent data |
| Volume cloning from snapshots | Agent memory | Snapshot-as-memory and A/B experimentation (enriched-corpus pattern) |

> **2026-06 currency note:** ANF now has large volumes GA, cool access, and an S3-compatible object REST API. The object API opens a future ingestion path that does not require NFS mounts in the ingestion namespace; it is not yet reflected in the manifests.

## Disaster Recovery Model

The recovery model follows `incubator/enterprise-azure-anf/runbooks/disaster-recovery-and-rollback.md`:

Recovery order:

1. recover ANF-backed database state,
2. restore or redeploy the retrieval API,
3. restore or redeploy guardrails and NIM services,
4. restore worker-tier runtime connectivity,
5. validate the grounded response flow end to end.

Rollback rule: rollback happens at service and storage boundaries, never by mutating upstream NemoClaw code in place.

Operator checklist: confirm the affected trust zone, identify the last known good snapshot or replica, restore database state before agent-side state, and validate retrieval plus guardrails before reopening user traffic.

## Snapshot-As-Memory

The enriched corpus sources propose ANF snapshots and clones as agent memory checkpoints: snapshot the agent-memory volume at known-good states, clone for experiments, and restore on corruption. This remains an `assumed` overlay pattern; restore semantics against live NemoClaw state have not been exercised (backlog item "agent memory and restore validation on ANF", `later`).

## Status Summary

| Item | Status |
|---|---|
| Volume layout and storage classes | `validated` as design; `assumed` for performance |
| PostgreSQL NFS mount profile | `assumed` (needs workload validation on Azure) |
| DR runbook | `assumed` (not yet exercised) |
| Snapshot-as-memory | `assumed` |

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
