---
name: nemomaxxing-deploy-platform
description: Use when deploying the NemoMaxxing platform workloads onto a bootstrapped AKS cluster — applying the numbered enterprise/deploy/k8s/ manifests with readiness gates, running the postgres bootstrap and verify jobs, bringing up NIMs, Gemma engines, nv-ingest, the retrieval API, console, and worker tier, then running the smoke sequence. Trigger keywords - deploy platform, apply manifests, postgres bootstrap, nimservice, gemma, nv-ingest, retrieval api, console, worker tier, smoke test.
---

# NemoMaxxing: Deploy Platform Workloads

Apply the Kubernetes layer in strict numbered order with a readiness gate after each stage. Prerequisite: both validation gates in `nemomaxxing-deploy-azure-infra` passed (ANF volumes exist, Trident backend online, GPU Operator and NIM Operator running, secrets present).

Honesty up front: the retrieval API code, schema bootstrap, and role/ACL enforcement are `validated` via local and CI e2e (`enterprise/services/retrieval-api/`, `.github/workflows/enterprise-retrieval-e2e.yaml`). Everything cluster-side in this skill — NIMs on real GPUs, nv-ingest against the ANF share, worker tier, console on AKS — is `assumed` and has never been run on a real Azure cluster. The first run is the validation event.

## Read Order

1. `enterprise/deploy/README.md`
2. `incubator/enterprise-azure-anf/specs/09-deployment-workstreams.md` — the dependency ordering this skill encodes.
3. `enterprise/services/retrieval-api/README.md` — bootstrap/verify semantics and env contract.
4. `incubator/enterprise-azure-anf/specs/07-security-trust-zones-and-guardrails.md` — field/vault roles and ACL model behind the smoke sequence.
5. The manifests under `enterprise/deploy/k8s/` in numbered order.

## Use This Skill When

- deploying or redeploying the full workload stack onto the AKS cluster
- bringing up a single tier (database, NIMs, ingestion, retrieval, console, workers) in dependency order
- running the post-deploy smoke sequence

## Workflow

Run `enterprise/deploy/scripts/03-deploy-stack.sh`, or apply manifests manually in this exact order. Never skip a gate.

### Stage 1 — Namespaces and Storage

- `kubectl apply -f enterprise/deploy/k8s/00-namespaces.yaml`
- `kubectl apply -f enterprise/deploy/k8s/10-storageclasses-anf.yaml`
- **Gate:** `kubectl get storageclass` lists the ANF classes; create-and-delete a 1Gi test PVC per class to confirm Trident binds (`kubectl get pvc -w` until `Bound`).

### Stage 2 — PostgreSQL + pgvector on ANF

- `kubectl apply -f enterprise/deploy/k8s/20-postgresql-pgvector.yaml` — StatefulSet with separate `pg-wal` (Ultra) and `pg-data` (Premium) ANF volumes.
- **Gate:** pod `Ready`, both PVCs `Bound` to ANF-backed PVs.
- **Bootstrap job, then verify job — both MUST pass before the retrieval API goes live:**
  1. Run the retrieval bootstrap job (applies the SQL migrations in `enterprise/services/retrieval-api/sql/` via the package's `npm run bootstrap`, fed by `RETRIEVAL_API_DATABASE_URL` from `retrieval-api-secrets/postgres-dsn`). Wait for `kubectl wait --for=condition=complete job/<bootstrap-job>`.
  2. Run the postgres verify job (`npm run verify:postgres` contract: checks the `vector` extension, `document_chunks` table, and the embedding/full-text/ACL indexes). Wait for completion.
  - If either job fails, stop. Do not deploy the retrieval API against an unverified schema.

### Stage 3 — Inference (NIMs and Gemma engines)

- `kubectl apply -f enterprise/deploy/k8s/30-nim-rag-services.yaml` — `NIMCache` populates the shared ANF `models-cache` volume first, then the embedder, reranker, and parse `NIMService` resources.
- `kubectl apply -f enterprise/deploy/k8s/31-nemotron-nimservice.yaml` — the Nemotron `NIMService`. Note the documented swap: Nemotron **Ultra 253B** is the flagship configuration; the **70B** variant is the cost-down swap when GPU budget or quota is constrained. Pick one deliberately and record which in the logbook — they have very different GPU footprints and cache sizes.
- `kubectl apply -f enterprise/deploy/k8s/32-gemma-vllm.yaml` and `enterprise/deploy/k8s/33-gemma-sglang.yaml` — the multi-engine Gemma deployments (vLLM and SGLang; the TRT-LLM path runs via NIM). These need the HF token secret.
- **Gate:** `NIMCache` resources report ready/cached; all `NIMService` pods `Ready` (`kubectl get nimservice -A`); each engine answers an OpenAI-compatible `/v1/models` request from inside the cluster. First-time model downloads onto ANF are slow — watch `kubectl describe nimcache` rather than assuming a hang.

### Stage 4 — Ingestion Pipeline

- `kubectl apply -f enterprise/deploy/k8s/40-nv-ingest-pipeline.yaml` — the nv-ingest NeMo Retriever pipeline (worker code: `enterprise/workers/nemo-retriever-ingest/`) mounting the ANF `rag-documents` share and writing chunks plus embeddings into PostgreSQL via `ingestion-secrets/postgres-dsn`.
- **Gate:** pipeline pods `Ready`; the rag-documents PVC `Bound`; the CronJob/job template references the parse and embedding NIM endpoints deployed in Stage 3.

### Stage 5 — Retrieval API

- `kubectl apply -f enterprise/deploy/k8s/50-retrieval-api.yaml` — only after Stage 2's bootstrap AND verify jobs completed.
- **Gate:** pods `Ready`; ingress network policy restricts callers to the worker-tier and ingestion namespaces; in-cluster `GET /healthz` returns success.

### Stage 6 — Console and Worker Tier

- `kubectl apply -f enterprise/deploy/k8s/60-console.yaml` — the web console (`enterprise/services/console/`, port 8090, env: `RETRIEVAL_API_URL`, `CHAT_ENDPOINT`, `CHAT_MODEL` pointing at the chosen Nemotron or Gemma endpoint).
- `kubectl apply -f enterprise/deploy/k8s/70-nemoclaw-worker-tier.yaml` — NemoClaw agents, grounded only through the retrieval API (never direct PostgreSQL, never the raw ANF share).
- **Gate:** console `/healthz` on port 8090 returns success; worker tier resolves and reaches the retrieval API endpoint.

### Smoke Sequence (run all four, in order)

1. **Retrieval health:** `GET /healthz` on the retrieval API service — expect success.
2. **Console health:** `GET /healthz` on the console (port 8090) — expect success.
3. **Field-agent query:** POST a `field-agent` role query to the retrieval API `/v1/query`. Expect results only from sanitized/public collections; any `principals` sent are stripped by policy.
4. **Vault-agent + principal query (ACL proof):** POST a `vault-agent` query carrying a `principals` list. Expect ACL-restricted chunks (non-empty `acl_principals`) returned ONLY when a principal matches, and the same query without matching principals to exclude them. This proves ACL enforcement end to end on the live stack.

Record the smoke results in the program logbook per `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`.

## Common Mistakes

- Deploying the retrieval API before the bootstrap and verify jobs complete — the deployment intentionally depends on a bootstrapped, verified schema.
- Skipping the `NIMCache` warm phase and misreading slow ANF model downloads as crashed pods.
- Deploying Nemotron Ultra 253B without confirming GPU quota; use the 70B cost-down swap when constrained, and log which variant is live.
- Pointing the console `CHAT_ENDPOINT` at a model that is not actually deployed.
- Letting the worker tier or any agent mount the raw `rag-documents` share or open a direct PostgreSQL connection — all knowledge access crosses the retrieval API seam.
- Declaring the smoke sequence passed without the vault-agent ACL check; health endpoints alone prove nothing about policy enforcement.
- Marking cluster items `validated` in chat only; update `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` and the logbook in the same pass.
