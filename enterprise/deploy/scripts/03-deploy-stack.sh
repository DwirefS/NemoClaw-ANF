#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# NemoMaxxing stage 3: apply the k8s/ manifests in numbered order with
# readiness gates between stages, then run the retrieval bootstrap job and
# the verify job. Fails loudly if verification fails.
#
# NOT YET VALIDATED against a real cluster.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/../k8s"

WAIT_TIMEOUT="${NEMOMAXXING_WAIT_TIMEOUT:-600s}"
JOB_TIMEOUT="${NEMOMAXXING_JOB_TIMEOUT:-900s}"

apply() {
  local file="$1"
  echo "==> kubectl apply -f ${file}"
  kubectl apply -f "${K8S_DIR}/${file}"
}

echo "==> Stage 00: namespaces"
apply 00-namespaces.yaml

echo "==> Stage 10: ANF storage classes"
apply 10-storageclasses-anf.yaml

echo "==> Stage 20: PostgreSQL + pgvector"
apply 20-postgresql-pgvector.yaml
kubectl rollout status statefulset/postgres-pgvector --namespace data-plane --timeout="${WAIT_TIMEOUT}"

echo "==> Stage 30/31: NIM services (embedder, reranker, Nemotron)"
apply 30-nim-rag-services.yaml
apply 31-nemotron-nimservice.yaml
echo "Waiting for NIM caches and services (large model pulls; this can take a while)..."
kubectl wait --for=jsonpath='{.status.state}'=Ready nimcache/embedder-cache nimcache/reranker-cache \
  --namespace inference --timeout="${JOB_TIMEOUT}" || {
  echo "ERROR: RAG NIM caches did not become Ready." >&2
  exit 1
}
kubectl wait --for=jsonpath='{.status.state}'=Ready nimservice/nemo-embedder nimservice/nemo-reranker \
  --namespace inference --timeout="${JOB_TIMEOUT}" || {
  echo "ERROR: RAG NIM services did not become Ready." >&2
  exit 1
}
echo "Nemotron cache/service readiness is gated separately (multi-hour pull for 253B):"
echo "  kubectl get nimcache,nimservice -n inference"

echo "==> Stage 32/33: Gemma open-weights paths (optional; require hf-token-secret)"
apply 32-gemma-vllm.yaml
apply 33-gemma-sglang.yaml

echo "==> Stage 40: ingestion pipeline"
apply 40-nv-ingest-pipeline.yaml

echo "==> Stage 50: retrieval API (bootstrap -> verify -> serve)"
apply 50-retrieval-api.yaml

echo "Waiting for retrieval-bootstrap job..."
if ! kubectl wait --for=condition=complete job/retrieval-bootstrap \
  --namespace data-plane --timeout="${JOB_TIMEOUT}"; then
  echo "ERROR: retrieval-bootstrap job did not complete. Migrations failed; do not proceed." >&2
  kubectl logs job/retrieval-bootstrap --namespace data-plane --tail=100 || true
  exit 1
fi

echo "Waiting for retrieval-postgres-verify job..."
if ! kubectl wait --for=condition=complete job/retrieval-postgres-verify \
  --namespace data-plane --timeout="${JOB_TIMEOUT}"; then
  echo "###############################################################" >&2
  echo "ERROR: PostgreSQL verification FAILED." >&2
  echo "The database does not match the expected retrieval schema" >&2
  echo "(vector extension, document_chunks, embedding/FTS/ACL indexes)." >&2
  echo "Do NOT serve retrieval traffic from this database." >&2
  echo "###############################################################" >&2
  kubectl logs job/retrieval-postgres-verify --namespace data-plane --tail=100 || true
  exit 1
fi

kubectl rollout status deployment/retrieval-api --namespace data-plane --timeout="${WAIT_TIMEOUT}"

echo "==> Stage 55: secure gateway (auth, redaction, audit)"
apply 55-gateway.yaml
kubectl rollout status deployment/retrieval-gateway --namespace data-plane --timeout="${WAIT_TIMEOUT}"

echo "==> Stage 60: console"
apply 60-console.yaml
kubectl rollout status deployment/console --namespace console --timeout="${WAIT_TIMEOUT}"

echo "==> Stage 70: NemoClaw worker tier"
apply 70-nemoclaw-worker-tier.yaml
kubectl rollout status statefulset/nemoclaw-worker --namespace agents --timeout="${WAIT_TIMEOUT}"

echo "OK: stack deployed and verified. Next: 04-validate-e2e.sh"
