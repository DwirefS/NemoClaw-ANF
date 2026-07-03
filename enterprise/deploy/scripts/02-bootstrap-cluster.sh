#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# NemoMaxxing stage 2: bootstrap the AKS cluster.
#   - helm install NVIDIA GPU Operator, NVIDIA NIM Operator, NetApp Trident
#   - create NGC, Hugging Face, and PostgreSQL secrets from environment
#     variables (secret values are never echoed)
#
# Required environment variables:
#   NGC_API_KEY        NGC API key (image pulls + model downloads)
#   POSTGRES_USER      PostgreSQL superuser name
#   POSTGRES_PASSWORD  PostgreSQL superuser password
# Optional:
#   HF_TOKEN           Hugging Face token (Gemma paths in k8s/32, k8s/33)
#
# NOT YET VALIDATED against a real cluster.

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} must be set in the environment." >&2
    exit 1
  fi
}

require_env NGC_API_KEY
require_env POSTGRES_USER
require_env POSTGRES_PASSWORD

for tool in kubectl helm; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "ERROR: ${tool} not found." >&2
    exit 1
  fi
done

echo "==> Installing NVIDIA GPU Operator"
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo add netapp-trident https://netapp.github.io/trident-helm-chart
helm repo update

helm upgrade --install gpu-operator nvidia/gpu-operator \
  --namespace gpu-operator --create-namespace \
  --wait --timeout 15m

echo "==> Installing NVIDIA NIM Operator"
helm upgrade --install nim-operator nvidia/k8s-nim-operator \
  --namespace nim-operator --create-namespace \
  --wait --timeout 10m

echo "==> Installing NetApp Trident"
helm upgrade --install trident netapp-trident/trident-operator \
  --namespace trident --create-namespace \
  --wait --timeout 10m

echo "==> Creating namespaces (required before secrets)"
kubectl apply -f "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../k8s/00-namespaces.yaml"

echo "==> Creating NGC secrets (values not echoed)"
# Extend this list when other namespaces need NGC pull access.
NGC_NAMESPACES=(inference)
for ns in "${NGC_NAMESPACES[@]}"; do
  # NGC requires the literal username $oauthtoken; it must not expand.
  kubectl create secret docker-registry ngc-secret \
    --namespace "${ns}" \
    --docker-server=nvcr.io \
    --docker-username="\$oauthtoken" \
    --docker-password="${NGC_API_KEY}" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret generic ngc-api-secret \
    --namespace "${ns}" \
    --from-literal=NGC_API_KEY="${NGC_API_KEY}" \
    --dry-run=client -o yaml | kubectl apply -f -
done

if [[ -n "${HF_TOKEN:-}" ]]; then
  echo "==> Creating Hugging Face token secret (value not echoed)"
  kubectl create secret generic hf-token-secret \
    --namespace inference \
    --from-literal=token="${HF_TOKEN}" \
    --dry-run=client -o yaml | kubectl apply -f -
else
  echo "WARNING: HF_TOKEN not set; skipping hf-token-secret (k8s/32 and k8s/33 will not start)."
fi

echo "==> Creating PostgreSQL secrets (values not echoed)"
POSTGRES_DSN="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-pgvector.data-plane.svc.cluster.local:5432/nemoclaw_rag"

kubectl create secret generic postgres-auth \
  --namespace data-plane \
  --from-literal=username="${POSTGRES_USER}" \
  --from-literal=password="${POSTGRES_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic retrieval-api-secrets \
  --namespace data-plane \
  --from-literal=postgres-dsn="${POSTGRES_DSN}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic ingestion-secrets \
  --namespace ingestion \
  --from-literal=postgres-dsn="${POSTGRES_DSN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Validation gate"
echo "Waiting for Trident controller..."
kubectl rollout status deployment/trident-controller --namespace trident --timeout=300s

echo "NOTE: apply a TridentBackendConfig for the ANF account before stage 3."
echo "Template: incubator/enterprise-azure-anf/manifests/trident-backend-anf.yaml"
echo "(fill in subscription, tenant, managed identity, and the ANF account/pools"
echo "from the stage 1 deployment outputs)."

echo "OK: cluster bootstrapped. Next: 03-deploy-stack.sh"
