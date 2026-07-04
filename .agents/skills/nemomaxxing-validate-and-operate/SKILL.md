---
name: nemomaxxing-validate-and-operate
description: Use when validating a deployed NemoMaxxing stack end to end or operating it day to day — running 04-validate-e2e.sh and the package harnesses, performing ingestion operations on the ANF document share, troubleshooting common failures, benchmarking, and keeping the tracker and logbook current. Trigger keywords - validate e2e, operate, ingestion, troubleshoot, hnsw, nim cache, trident mount, benchmark, verify postgres.
---

# NemoMaxxing: Validate And Operate

Validate the deployed stack, run ingestion operations, troubleshoot, benchmark, and keep the program control surfaces honest.

Honesty up front (tracker vocabulary from `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`): the retrieval-path harnesses (`npm run verify:postgres`, `npm run e2e:local`) are `validated` locally and in CI against real PostgreSQL 16 + pgvector. `enterprise/deploy/scripts/04-validate-e2e.sh`, ingestion against live NeMo Retriever outputs, live NIM integration, and anything on a real AKS + ANF cluster are `assumed` — never yet run on Azure. Production guardrail rails are `custom-build-required`; identity mapping for asserted principals and Azure-native secret alignment are `blocked`.

## Read Order

1. `enterprise/deploy/README.md`
2. `enterprise/services/retrieval-api/README.md` — bootstrap/verify/e2e commands and env contract.
3. `incubator/enterprise-azure-anf/runbooks/ingestion-operations.md`
4. `incubator/enterprise-azure-anf/runbooks/benchmarking.md`
5. `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md` — post-operation update rules.

## Use This Skill When

- running the end-to-end validation suite after a deploy
- ingesting new documents onto the ANF rag-documents share
- diagnosing retrieval, ingestion, NIM, or storage failures
- benchmarking PostgreSQL-on-ANF or the retrieval path
- closing out any operational pass (tracker/logbook/backlog updates)

## Workflow

### End-To-End Validation

1. Run `enterprise/deploy/scripts/04-validate-e2e.sh` against the deployed cluster (`assumed` — first Azure run is the validation event; capture output).
2. Run the package-level harnesses from `enterprise/services/retrieval-api/`:
   - `npm run verify:postgres` — checks the `vector` extension, `document_chunks` table, and embedding/full-text/ACL indexes (requires `RETRIEVAL_API_DATABASE_URL`).
   - `npm run e2e:local` — seeds a sample corpus, mocks the embedding/reranking NIM contracts, boots the service in `pgvector` mode, and asserts role and ACL enforcement over HTTP. `validated` locally and in CI (`.github/workflows/enterprise-retrieval-e2e.yaml`); re-running it pointed at the cluster database is the cluster-validation step the backlog calls for.
3. Run the console e2e from `enterprise/services/console/` (`npm run e2e:local`; service runs on port 8090 with `RETRIEVAL_API_URL`, `CHAT_ENDPOINT`, `CHAT_MODEL`).
4. Re-run the smoke sequence from the `nemomaxxing-deploy-platform` skill: retrieval `/healthz`, console `/healthz`, one field-agent query, one vault-agent+principal query proving ACL enforcement.

### Ingestion Operations

Per `incubator/enterprise-azure-anf/runbooks/ingestion-operations.md` (detect, parse, chunk and embed, write, validate visibility):

1. Drop documents onto the ANF `rag-documents` share (via an NFS mount or a pod mounting the PVC). Never give agents this mount.
2. Trigger or wait for the ingest job (`enterprise/deploy/k8s/40-nv-ingest-pipeline.yaml`; the incubator pattern is a reconcile CronJob). Watch with `kubectl logs -f job/<ingest-job> -n <ingestion-ns>`.
3. Verify results in PostgreSQL: chunk counts per source (`SELECT source, count(*) FROM document_chunks GROUP BY source`) and `acl_principals` populated as expected — empty array means unrestricted; non-empty means principal-gated. Re-ingestion should upsert (content-addressed chunk ids), not duplicate.
4. Confirm visibility through the retrieval API with a role-appropriate query, never by querying PostgreSQL on the agent's behalf.

Live NeMo Retriever output validation is still `next` in the backlog; treat surprising chunk shapes as findings to record, not silently normalize.

### Troubleshooting Table

| Symptom | Likely Cause | Action |
|---|---|---|
| HNSW index build fails with a dimension error | pgvector caps `vector` HNSW indexes at 2000 dimensions; schema is `vector(1024)` for `nvidia/nv-embedqa-e5-v5` | Do not raise the column size for a bigger model; a larger embedder requires a coordinated migration to a `halfvec` index strategy (pgvector 0.7+). See `enterprise/services/retrieval-api/README.md` |
| Embedding insert fails with dimension mismatch | Embedding NIM model does not match the `vector(1024)` schema | Align `CHAT`/embedding model config with the schema before re-ingesting |
| NIM pods stuck pulling or re-downloading models | `NIMCache` miss — cache volume not bound, wrong ANF `models-cache` PVC, or NGC key secret missing | `kubectl describe nimcache`; confirm the cache PVC is `Bound` to the ANF volume and the NGC secret exists (check by name only) |
| PVC stuck `Pending` | Trident mount failure — backend offline, ANF subnet delegation missing, or storage class misnamed | `tridentctl get backend -n trident`; check Trident pod logs; verify `enterprise/deploy/k8s/10-storageclasses-anf.yaml` class names match claims |
| Pod or node hangs in D-state on storage I/O | Hard-mount NFS semantics: ANF volumes mounted `hard` block forever if the volume or network path disappears | This is intentional for PostgreSQL data integrity — fix the volume/network path rather than switching to soft mounts; check ANF volume state and VNet routes |
| Retrieval API up but queries fail on a fresh DB | Bootstrap or verify job skipped | Run the bootstrap job, then the verify job; the API must not serve an unverified schema |
| Vault-agent gets no restricted chunks | No matching `principals` on the request, or `acl_principals` never captured at ingestion | Check request principals; remember automatic ACL capture from ANF share permissions is still open (`in-progress`/`blocked`) |

### Benchmarking

Follow `incubator/enterprise-azure-anf/runbooks/benchmarking.md`: measure ingestion throughput, query latency, retrieval recall, rerank latency, grounded answer latency, and model cold-start timing with the shared ANF cache; always compare baseline versus ANF-optimized paths and record workload shape, environment matrix, and volume class. PostgreSQL-on-ANF tier benchmarking (separate WAL/data volumes, hard NFS mounts) is `next` in the backlog and is what proves the `assumed` storage-class choices.

## Required Behaviors

- After EVERY operation pass (validation, ingestion, incident, benchmark), update `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` (status), `specs/16-program-logbook.md` (chronology, conflicts and resolutions), and `specs/17-delivery-backlog-and-dependencies.md` (remaining work) per the change-control rules in `specs/18-change-control-and-execution-rules.md`.
- Keep statuses honest: a green mocked run does not make a live integration `validated`.
- Never echo DSNs, tokens, or secret values in validation output.
- Never remove or destructively replace deployment assets without explicit user approval.

## Common Mistakes

- Running only `/healthz` checks and calling the stack validated; the ACL-proving query pair is the real test.
- Confusing the CI-`validated` local e2e with cluster validation, which the backlog tracks separately.
- "Fixing" a hard-mount NFS hang by force-deleting pods instead of restoring the storage path.
- Bypassing the retrieval API with direct SQL to check agent-visible results.
- Finishing an operations pass without logbook and tracker updates — chat-only records are explicitly disallowed.
