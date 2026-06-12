<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# NemoMaxxing Deployment

NemoMaxxing is the deployable end-to-end platform built from the Enterprise Azure ANF
overlay: **everything Azure** for infrastructure, **everything NVIDIA** for GPU compute
and the application layer, **everything Azure NetApp Files (ANF)** for persistent storage.

This tree turns the incubator design (`incubator/enterprise-azure-anf/`) into an
apply-ordered deployment bundle. The incubator manifests remain the design reference;
the manifests here are the deployable adaptations.

## Layer Model

| Layer | Technology | Assets |
|---|---|---|
| Infrastructure | Azure (resource group, VNet, AKS, Key Vault) | `azure/main.bicep` + `azure/modules/` |
| Persistent storage | Azure NetApp Files (account, capacity pools, volumes, Trident CSI) | `azure/modules/anf.bicep`, `k8s/10-storageclasses-anf.yaml` |
| GPU compute / application | NVIDIA (GPU Operator, NIM Operator, NIM services, NeMo Retriever, NemoClaw worker tier) | `k8s/30-*` through `k8s/70-*`, `scripts/` |

## ANF Volume Layout

Follows `incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md`:

| Volume | Tier | Consumer |
|---|---|---|
| `models-cache` | Premium | NIM model caches (RWX, shared across NIM pods) |
| `pg-wal` | Ultra | PostgreSQL write-ahead log |
| `pg-data` | Premium | PostgreSQL data |
| `rag-documents` | Standard | NeMo Retriever ingest source (NFS; optional SMB for office-side drops) |
| `agent-workspace` | Premium | NemoClaw worker-tier persistent agent state |

## Prerequisites

- Azure CLI (`az`) logged in to a subscription with GPU quota for the chosen
  GPU VM size (default `Standard_NC24ads_A100_v4`; the Nemotron Ultra 253B profile
  needs a multi-GPU SKU such as `Standard_ND96isr_H100_v5`)
- Subscription registered for `Microsoft.NetApp` and ANF regional capacity
- `kubectl` and `helm`
- NGC API key (`NGC_API_KEY`) for NIM image pulls and model downloads
- Hugging Face token (`HF_TOKEN`) for the Gemma open-weights paths (32/33)
- PostgreSQL credentials exported as environment variables (see `scripts/02-bootstrap-cluster.sh`)

## Apply Order and Validation Gates

Run the scripts in order. Each stage has a gate; do not continue past a failed gate.

1. **`scripts/01-deploy-infra.sh`** — deploys `azure/main.bicep` (resource group, VNet,
   ANF account + pools + volumes, AKS, Key Vault + workload identity).
   *Gate:* `az deployment sub show` reports `Succeeded`; ANF volumes have mount IPs;
   `az aks get-credentials` works.
2. **`scripts/02-bootstrap-cluster.sh`** — helm installs the NVIDIA GPU Operator,
   NVIDIA NIM Operator, and NetApp Trident; creates `ngc-secret`/`ngc-api-secret`,
   postgres, and HF token secrets from environment variables.
   *Gate:* GPU Operator validations pass (`nvidia-smi` DaemonSet ready), Trident pods
   ready, `tridentbackendconfig` phase `Bound`.
3. **`scripts/03-deploy-stack.sh`** — applies `k8s/` in numbered order with readiness
   waits between stages, then runs the retrieval bootstrap job followed by the
   verify job and fails loudly if verification fails.
   *Gate:* every numbered stage Ready; `retrieval-postgres-verify` job `Complete`.
4. **`scripts/04-validate-e2e.sh`** — port-forwards the retrieval API and runs the
   package end-to-end validation against the in-cluster database, plus console
   health and chat-endpoint curl checks.
   *Gate:* printed summary is `PASS`.

## Validation Status (honest accounting)

**None of this tree has been applied to a real Azure subscription yet.** Statuses:

| Asset | Status |
|---|---|
| Bicep templates (`azure/`) | **Not validated.** Authored from documented resource types; never compiled with `az bicep build` nor deployed. Operator-verify comments mark the riskiest spots (API versions, ANF sizing minimums, VM SKU availability). |
| Storage classes, Trident wiring (`k8s/10`) | Pattern `validated` in the incubator as design; **not cluster-validated** here. |
| PostgreSQL + pgvector (`k8s/20`) | Schema bootstrap and verification code paths are validated in CI against a `pgvector/pgvector` container; the ANF-backed StatefulSet itself is **not cluster-validated**. |
| NIM services (`k8s/30`, `k8s/31`) | NIMCache/NIMService pattern follows the incubator `validated` pattern; **not cluster-validated**, and the 253B tensor-parallel profile is unproven on this layout. |
| vLLM / SGLang Gemma paths (`k8s/32`, `k8s/33`) | **Not cluster-validated.** |
| Ingestion, retrieval API, console, worker tier (`k8s/40`–`70`) | Retrieval API service code has a CI-validated local e2e (`npm run e2e:local`); all in-cluster wiring is **not cluster-validated**. The console image contract is being built in parallel from `enterprise/services/console/`. |
| Scripts (`scripts/`) | Syntax-checked only; **never run against a live subscription or cluster**. |

Structural integrity (files exist, YAML parses, env contracts present, scripts are
executable) is enforced by `test/enterprise-deploy-assets.test.ts`.
