#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# NemoMaxxing stage 1: deploy the Azure infrastructure (resource group, VNet,
# ANF account/pools/volumes, AKS, Key Vault) from enterprise/deploy/azure/.
#
# NOT YET VALIDATED against a real Azure subscription.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_DIR="${SCRIPT_DIR}/../azure"

# Required / overridable parameters.
LOCATION="${NEMOMAXXING_LOCATION:-eastus2}"
PREFIX="${NEMOMAXXING_PREFIX:-nemomaxxing}"
GPU_VM_SIZE="${NEMOMAXXING_GPU_VM_SIZE:-Standard_NC24ads_A100_v4}"
GPU_NODE_COUNT="${NEMOMAXXING_GPU_NODE_COUNT:-2}"
DEPLOYMENT_NAME="${NEMOMAXXING_DEPLOYMENT_NAME:-${PREFIX}-infra}"

echo "NemoMaxxing infra deployment"
echo "Required tooling: az CLI logged in to the target subscription."
echo
echo "Parameters (override via environment variables):"
echo "  NEMOMAXXING_LOCATION        = ${LOCATION}"
echo "  NEMOMAXXING_PREFIX          = ${PREFIX}"
echo "  NEMOMAXXING_GPU_VM_SIZE     = ${GPU_VM_SIZE}"
echo "  NEMOMAXXING_GPU_NODE_COUNT  = ${GPU_NODE_COUNT}"
echo "  NEMOMAXXING_DEPLOYMENT_NAME = ${DEPLOYMENT_NAME}"
echo
echo "Note: the Nemotron Ultra 253B profile (k8s/31) needs a multi-GPU SKU"
echo "such as Standard_ND96isr_H100_v5; verify regional quota first."
echo

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

echo "==> Compiling Bicep (template has not been cluster-validated; compile errors stop here)"
az bicep build --file "${BICEP_DIR}/main.bicep"

echo "==> Deploying subscription-scoped template"
az deployment sub create \
  --name "${DEPLOYMENT_NAME}" \
  --location "${LOCATION}" \
  --template-file "${BICEP_DIR}/main.bicep" \
  --parameters \
    location="${LOCATION}" \
    prefix="${PREFIX}" \
    gpuVmSize="${GPU_VM_SIZE}" \
    gpuNodeCount="${GPU_NODE_COUNT}"

echo "==> Validation gate"
STATE="$(az deployment sub show --name "${DEPLOYMENT_NAME}" --query properties.provisioningState -o tsv)"
if [[ "${STATE}" != "Succeeded" ]]; then
  echo "ERROR: deployment state is '${STATE}', expected 'Succeeded'." >&2
  exit 1
fi

echo "==> Deployment outputs"
az deployment sub show --name "${DEPLOYMENT_NAME}" --query properties.outputs -o json

echo "==> Fetching AKS credentials"
RESOURCE_GROUP="rg-${PREFIX}"
az aks get-credentials --resource-group "${RESOURCE_GROUP}" --name "${PREFIX}-aks" --overwrite-existing

echo "OK: infrastructure deployed. Next: 02-bootstrap-cluster.sh"
