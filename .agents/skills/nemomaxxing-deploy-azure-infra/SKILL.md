---
name: nemomaxxing-deploy-azure-infra
description: Use when deploying the NemoMaxxing Azure foundation — Bicep infrastructure (VNet, ANF account/pools/volumes, AKS GPU cluster, Key Vault) and cluster bootstrap (GPU Operator, NIM Operator, Trident, secrets) — before any platform workloads are applied. Trigger keywords - deploy infra, bicep, anf volumes, aks gpu, bootstrap cluster, trident, key vault.
---

# NemoMaxxing: Deploy Azure Infrastructure

Provision the Azure layer and bootstrap the AKS cluster. This skill covers `enterprise/deploy/scripts/01-deploy-infra.sh` and `02-bootstrap-cluster.sh` plus the validation gate after each step.

Honesty up front: every step in this skill is `assumed` per the tracker vocabulary in `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` — none of these scripts or Bicep templates has ever been run against a real Azure subscription. Treat first execution as validation work, expect drift, and record results.

## Read Order

1. `enterprise/deploy/README.md`
2. `incubator/enterprise-azure-anf/specs/09-deployment-workstreams.md` — sequencing and secret contract.
3. `incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md` — volume roles and service levels.
4. `enterprise/deploy/azure/main.bicep` and `enterprise/deploy/azure/modules/` (`network.bicep`, `anf.bicep`, `aks.bicep`, `keyvault.bicep`).
5. `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md` — logbook and tracker obligations.

## Use This Skill When

- standing up the Azure subscription resources for NemoMaxxing from scratch
- re-provisioning ANF pools/volumes or the AKS GPU pool
- bootstrapping a fresh cluster with operators and secrets before platform deploy

## Workflow

### Step 0 — Prerequisites Checklist

Verify ALL of these before running anything. Stop and report any gap.

- Azure subscription with rights to create resource groups, VNets, ANF accounts, AKS clusters, and Key Vaults (`az account show`).
- GPU quota in the target region for the chosen GPU VM SKU (`az vm list-usage --location <region> -o table` — check the relevant NC/ND family).
- NGC API key (for NIM images and NIMCache pulls). Confirm it exists as an environment variable or Key Vault entry; never print it.
- Hugging Face token (for Gemma weights via vLLM/SGLang). Same handling: confirm presence, never echo.
- CLI tooling installed and logged in: `az` (logged in, correct subscription selected), `kubectl`, `helm`.

### Step 1 — Run `enterprise/deploy/scripts/01-deploy-infra.sh`

Deploys `enterprise/deploy/azure/main.bicep`, which composes the modules:

- `modules/network.bicep` — VNet with an ANF-delegated subnet (`Microsoft.NetApp/volumes` delegation) plus the AKS subnet.
- `modules/anf.bicep` — NetApp account, capacity pools, and volumes: `pg-wal` (Ultra service level), `pg-data` (Premium), `models-cache`, `rag-documents`, `agent-workspace`.
- `modules/aks.bicep` — AKS cluster with a system pool, a GPU node pool, and OIDC/workload identity enabled.
- `modules/keyvault.bicep` — Key Vault for the secret contract (postgres DSNs, NGC key, HF token).

**Validation gate (must pass before Step 2):**

- `az deployment group show ...` reports `provisioningState: Succeeded` (or `az deployment sub show` if subscription-scoped — check the script).
- `az netappfiles volume list -g <rg> --account-name <acct> --pool-name <pool> -o table` lists all five volumes with the expected service levels (pg-wal Ultra, pg-data Premium).
- `az aks show -g <rg> -n <cluster> --query "agentPoolProfiles[].{name:name,vmSize:vmSize,count:count}" -o table` shows the GPU pool.
- `az aks show -g <rg> -n <cluster> --query oidcIssuerProfile.issuerUrl` returns a URL (workload identity prerequisite).
- `az keyvault show -n <kv>` succeeds.
- `az aks get-credentials -g <rg> -n <cluster>` then `kubectl get nodes` shows all nodes `Ready`, including GPU nodes.

### Step 2 — Run `enterprise/deploy/scripts/02-bootstrap-cluster.sh`

Installs cluster-level dependencies:

- NVIDIA GPU Operator (driver, device plugin, DCGM).
- NVIDIA NIM Operator (provides the `NIMCache`/`NIMService` CRDs used by `enterprise/deploy/k8s/30-nim-rag-services.yaml` and `31-nemotron-nimservice.yaml`).
- NetApp Trident (CSI driver and backend pointing at the ANF account, feeding `enterprise/deploy/k8s/10-storageclasses-anf.yaml`).
- Kubernetes secrets wired from Key Vault (NGC key, HF token, postgres DSNs per the secret contract in spec 09: `retrieval-api-secrets/postgres-dsn` feeds `POSTGRES_DSN` for the retrieval service and `RETRIEVAL_API_DATABASE_URL` for the bootstrap and verify jobs — the env contract documented in `enterprise/services/retrieval-api/README.md`; the ingestion namespace uses its own `ingestion-secrets/postgres-dsn`).

**Validation gate (must pass before platform deploy):**

- `kubectl get pods -n gpu-operator` — all pods `Running`/`Completed`; `kubectl describe node <gpu-node> | grep nvidia.com/gpu` shows allocatable GPUs.
- `kubectl get crd nimservices.apps.nvidia.com nimcaches.apps.nvidia.com` exist and the NIM Operator pod is `Running`.
- `kubectl get tridentbackendconfig -n trident` (or `tridentctl get backend -n trident`) shows the ANF backend `online`/`Bound`.
- `kubectl get secret` in the target namespaces confirms the expected secret names exist. Check NAMES ONLY — never `kubectl get secret -o yaml` into the transcript.

When both gates pass, hand off to `nemomaxxing-deploy-platform`.

## Required Behaviors

- Never echo secrets: no printing of NGC keys, HF tokens, DSNs, or Key Vault secret values in commands, logs, or reports. Verify by name and existence only.
- Record every infra run (success or failure, with the validation-gate outcomes) in the program logbook at `incubator/enterprise-azure-anf/specs/16-program-logbook.md`, and update the tracker (`specs/15`) and backlog (`specs/17`) if a status changed — required by `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`.
- The first successful run on a real subscription moves items from `assumed` toward `validated`; say so explicitly in the tracker rather than silently assuming it.
- Do not delete or destructively replace existing resources or repo assets without explicit user approval (spec 18).

## Common Mistakes

- Skipping the GPU quota check and discovering the failure 20 minutes into AKS provisioning.
- Putting `pg-wal` on a non-Ultra service level; WAL latency directly gates PostgreSQL commit throughput.
- Forgetting the ANF subnet delegation, which makes every volume creation fail.
- Installing platform workloads before the Trident backend is online, producing PVCs stuck in `Pending`.
- Echoing a DSN or token while "just debugging" — this violates the credential-sanitization model.
- Treating a clean first run as already-`validated` history; it is the validation event and must be logged as such.
