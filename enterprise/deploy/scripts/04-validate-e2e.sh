#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# NemoMaxxing stage 4: end-to-end validation.
#   - port-forward the retrieval API and PostgreSQL, run the package e2e
#     (enterprise/services/retrieval-api: npm run e2e:local) against the
#     in-cluster database
#   - curl the console /healthz and the chat endpoint
#   - print a PASS/FAIL summary
#
# NOT YET VALIDATED against a real cluster.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
RETRIEVAL_API_DIR="${REPO_ROOT}/enterprise/services/retrieval-api"

PASS_COUNT=0
FAIL_COUNT=0
SUMMARY=""

record() {
  local status="$1" name="$2"
  SUMMARY+="  [${status}] ${name}"$'\n'
  if [[ "${status}" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

PORT_FORWARD_PIDS=()
# Invoked indirectly via the EXIT trap.
# shellcheck disable=SC2317
cleanup() {
  for pid in "${PORT_FORWARD_PIDS[@]:-}"; do
    kill "${pid}" 2>/dev/null || true
  done
}
trap cleanup EXIT

port_forward() {
  local target="$1" namespace="$2" mapping="$3"
  kubectl port-forward "${target}" --namespace "${namespace}" "${mapping}" >/dev/null 2>&1 &
  PORT_FORWARD_PIDS+=("$!")
}

echo "==> Port-forwarding in-cluster services"
port_forward svc/retrieval-api data-plane 18080:8080
port_forward svc/postgres-pgvector data-plane 15432:5432
port_forward svc/console console 18090:8090
port_forward svc/nemotron-llm inference 18000:8000
sleep 5

echo "==> Retrieval API /healthz"
if curl -fsS --max-time 10 http://127.0.0.1:18080/healthz >/dev/null; then
  record PASS "retrieval-api /healthz"
else
  record FAIL "retrieval-api /healthz"
fi

echo "==> Package e2e against the in-cluster database"
# RETRIEVAL_API_DATABASE_URL must point at the forwarded in-cluster postgres;
# credentials come from the operator environment, never from this script.
if [[ -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  E2E_DSN="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:15432/nemoclaw_rag"
  if (cd "${RETRIEVAL_API_DIR}" && RETRIEVAL_API_DATABASE_URL="${E2E_DSN}" npm run e2e:local); then
    record PASS "retrieval-api package e2e (in-cluster DB)"
  else
    record FAIL "retrieval-api package e2e (in-cluster DB)"
  fi
else
  echo "WARNING: POSTGRES_USER/POSTGRES_PASSWORD not set; skipping package e2e." >&2
  record FAIL "retrieval-api package e2e (in-cluster DB) — credentials not provided"
fi

echo "==> Console /healthz"
if curl -fsS --max-time 10 http://127.0.0.1:18090/healthz >/dev/null; then
  record PASS "console /healthz"
else
  record FAIL "console /healthz"
fi

echo "==> Chat endpoint (OpenAI-compatible models listing)"
if curl -fsS --max-time 30 http://127.0.0.1:18000/v1/models >/dev/null; then
  record PASS "chat endpoint /v1/models"
else
  record FAIL "chat endpoint /v1/models"
fi

echo
echo "================ NemoMaxxing E2E Summary ================"
printf '%s' "${SUMMARY}"
echo "========================================================="
if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  echo "RESULT: PASS (${PASS_COUNT} checks)"
  exit 0
fi
echo "RESULT: FAIL (${FAIL_COUNT} of $((PASS_COUNT + FAIL_COUNT)) checks failed)"
exit 1
