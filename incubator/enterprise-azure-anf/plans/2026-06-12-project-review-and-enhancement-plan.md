<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Project Review And Enhancement Plan (2026-06-12)

This plan records a full fresh-eyes review of the repository, the decisions made during the 2026-06-12 implementation pass, the rationale for each, and the forward implementation roadmap. It follows the change-control rules in `incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`.

## What This Project Is

The repository is a fork of NVIDIA NemoClaw (sandboxed OpenClaw agents on OpenShell) carrying an enterprise overlay: a secure, stateful agent platform on Azure that combines AKS, Azure NetApp Files, NVIDIA NIM microservices, NeMo Retriever ingestion, PostgreSQL with `pgvector`, and a project-owned retrieval API as the only seam between the agent plane and enterprise knowledge. The published vision is the "Sovereign Agentic Factory" whitepaper (`artifacts/enterprise-azure-anf/sovereign-agentic-factory.pdf`): field agents in a low-trust zone, vault agents in a high-trust zone, a policy-enforcing secure gateway between them, multi-modal ingestion with ACL metadata, and an MCP-to-ANF bridge.

## What Is Good

- The upstream NemoClaw core is mature: a tested CLI, plugin, blueprint runner, SSRF validation, sandbox hardening, and a large security-regression test suite.
- The overlay respects clean boundaries: `enterprise/`, `incubator/`, `site/`, and `artifacts/` never touch upstream-owned zones, so upstream sync stays viable (ADR-001, spec 12).
- The retrieval API design is genuinely sound: role profiles instead of new runtimes (ADR-005), policy resolution before backend access, hybrid dense-plus-FTS retrieval with RRF fusion, and injectable NIM clients that honor the documented request contracts.
- The program-control discipline (tracker, logbook, backlog, change-control rules) is unusually good and made this review tractable.
- The corpus model preserves source provenance and contradictions instead of hiding them.

## What Was Wrong (Found And Fixed 2026-06-12)

| Defect | Root cause | Fix |
|---|---|---|
| Specs 00-14 and 18 missing (tests failing) | generic `specs/` rule in root `.gitignore` silently swallowed the directory | scoped negation in `.gitignore`; sixteen specs reconstructed from in-repo sources with provenance notes |
| `vector(3072)` schema could never build its HNSW index | dimension exceeded pgvector's 2000-dim HNSW cap and did not match the 1024-dim default model `nvidia/nv-embedqa-e5-v5` | schema now `vector(1024)` with the coupling documented |
| `npm start` / `npm run bootstrap` never ran | `--experimental-strip-types` requires explicit `.ts` import extensions; all imports were extensionless | explicit extensions everywhere; entrypoints validated live |
| Embeddings sent as `{...}` array literals | node-postgres and psycopg encode JS arrays / Python lists as PostgreSQL arrays, which the `vector` type rejects | `toVectorLiteral` + `::vector` casts in TypeScript and Python |
| Verification harness checked index names that never existed | harness written against assumed names, never executed | aligned to real index names plus the new ACL index |
| Author-machine absolute paths across docs and skills | incubator authored on a single machine | repo-relative paths everywhere; corpus manifest paths annotated as historical provenance |
| Migrations re-ran every file on every bootstrap | no applied-migration tracking | `schema_migrations` ledger in the migration runner |
| Re-ingestion duplicated rows | random UUID chunk ids | content-addressed ids (SHA-256 of source and content) |
| Enterprise code outside lint scope | Biome includes never extended | retrieval service added to root Biome scope |

Every defect in the live path was found by doing what the backlog itself prescribed: running the system against a real database. The lesson is recorded in spec 14 — contract tests against mocks validate shapes, not behavior.

## What Was Proven End To End (2026-06-12)

Against a real PostgreSQL 16 deployment with pgvector 0.8.2:

1. `npm run bootstrap` — applies both migrations, builds the HNSW, GIN-FTS, and GIN-ACL indexes, records the ledger.
2. `npm run verify:postgres` — passes.
3. `npm run e2e:local` — seeds a four-document corpus (public, sanitized, ACL-restricted sensitive, ACL-restricted regulated), runs mock embedding/reranking NIM servers honoring the documented contracts, boots the service in `pgvector` mode, and proves over HTTP:
   - field-agent grounds only on sanitized collections
   - field-agent cannot escalate via principals or collection requests (403)
   - vault-agent without principals sees only unrestricted chunks
   - vault-agent with a matching principal retrieves the ACL-restricted chunk, and non-matching ACLs stay hidden
4. The same flow runs in CI on every enterprise change via `.github/workflows/enterprise-retrieval-e2e.yaml` (pgvector service container).

## New Capability Landed: ACL-Aware Retrieval (First Half)

Decision: implement the metadata model and retrieval-time enforcement now; leave identity mapping to a gateway component.

- `sql/002_acl_principals.sql` — `acl_principals TEXT[]` (empty = unrestricted) with a GIN index.
- Requests may carry `principals`; policy resolution strips them from sanitized-only roles, so a field agent can never reach restricted chunks regardless of what it asserts.
- The SQL predicate `(acl_principals = '{}' OR acl_principals && $6)` is applied inside both the vector and FTS CTEs, before fusion, so restricted content never enters ranking for unauthorized requests.
- The ingestion writer persists `acl_principals` from chunk metadata.

Why this design: it mirrors the established permission-aware-RAG pattern (filter pushed into the store, not applied post-hoc), stays index-friendly, and is upgradeable to PostgreSQL row-level security later (with the LEAKPROOF caveat recorded in spec 14). What it deliberately does not do: decide who may assert which principals. That belongs to an authenticating gateway (Entra ID / workload identity), tracked as `blocked` in the backlog.

## Gaps That Remain (Honest Status)

- **Identity mapping** — the API trusts asserted principals; without an authenticating gateway this is enforcement without authentication. Highest remaining security gap.
- **Source ACL capture** — `acl_principals` must eventually come from ANF share ACLs automatically, not hand-authored metadata.
- **Live NIM validation** — embedding and reranker clients are contract-tested and e2e-tested against mocks, never against GPU-backed NIMs.
- **Live NeMo Retriever validation** — the worker's normalization is unproven against real `nv-ingest` output; the pinned `release/26.03` is behind the current `release/26.1.2` (which adds stricter Parquet validation).
- **Cluster validation** — everything proven here ran on a local PostgreSQL; the AKS-plus-ANF deployment (Trident, storage classes, separate WAL/data volumes, hard NFS mounts) is still manifest-only.
- **Secrets** — the manifests use static Kubernetes secrets; AKS best practice is Workload Identity plus Key Vault CSI, and the worker tier needs a VM managed-identity path.
- **Benchmarking** — acceptance gates in spec 10 are defined but none have been run.
- **Raw corpus files** — only normalized derivatives are committed; original research documents remain uncommitted (provenance limitation, recorded in spec 02).

## Forward Roadmap

### Wave A — Platform validation (requires Azure access)

1. Deploy the incubator manifests to AKS with ANF volumes; re-run bootstrap, verification, and `e2e:local` in-cluster.
2. Deploy embedding and reranker NIMs via NIM Operator; run the e2e with real NIMs instead of mocks (the script's mock server is drop-in replaceable by endpoint env vars).
3. Benchmark PostgreSQL on ANF service levels per spec 10: separate Ultra WAL volume, Premium data volume, `hard` NFS mounts, `rsize/wsize=65536` baseline.

### Wave B — Security completion

1. Authenticating gateway in front of the retrieval API: Entra ID token validation, principal extraction, audit logging. This closes the identity-mapping gap and realizes the whitepaper's "secure gateway".
2. Automatic ACL capture during ingestion from ANF share permissions (NFSv4 ACLs / SMB security descriptors).
3. Key Vault CSI plus Workload Identity for AKS secrets; VM managed identity for the worker tier.
4. NeMo Guardrails (now NIM Operator-managed) on the agent-facing path: input rail, retrieval rail against indirect prompt injection in retrieved chunks, output rail.

### Wave C — Ecosystem currency and capability growth

1. Upgrade nv-ingest to `release/26.1.2` and add Parquet NA-sanitization in the worker.
2. MCP server surface over the retrieval API (the whitepaper's "MCP-to-ANF bridge"): expose `retrieval.search` as an MCP tool so OpenClaw agents consume the boundary natively; instrument with the OpenTelemetry MCP semantic conventions.
3. OpenTelemetry GenAI instrumentation in the retrieval API (experimental attribute set, internal-only until the spec stabilizes).
4. Retrieval quality evaluation harness (RAGAS-style faithfulness and context precision) wired to the benchmarking runbook.
5. ANF-backed agent memory tiers: snapshot-as-memory validation for workspace state, episodic memory in PostgreSQL, semantic memory in the existing vector store.
6. Evaluate `halfvec` storage (50% footprint) and `hnsw.iterative_scan = relaxed_order` for ACL-filtered recall; evaluate VectorChord-BM25 as a native hybrid alternative.

### Wave D — Productization

1. Promote stable overlay docs through the promotion runbook into official docs once Wave A and B gates pass.
2. CLI integration: `nemoclaw enterprise` command group for retrieval-stack provisioning and status (currently the overlay is invisible to the CLI).

## Execution Record

All 2026-06-12 changes, decisions, and conflicts are recorded in:

- `incubator/enterprise-azure-anf/specs/16-program-logbook.md` (chronology and conflict resolutions)
- `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md` (status changes)
- `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md` (backlog movement)
