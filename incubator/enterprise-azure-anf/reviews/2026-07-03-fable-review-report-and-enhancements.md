<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Fable Review Report And Enhancements (2026-07-03)

This is the comprehensive review-and-handover document for the NemoMaxxing program: what this repository is, what was found on review, what was built and why, my inputs on the architecture and code, and a trend-grounded roadmap for the next development phases. It is written for the project owner resuming development after a pause, and for any engineer or agent picking the project up cold.

Companion records: the chronological logbook (`../specs/16-program-logbook.md`), the status tracker (`../specs/15-engineering-tracker.md`), the dependency backlog (`../specs/17-delivery-backlog-and-dependencies.md`), and the dated plans in `../plans/`.

## 1. The Project In One Page

NemoMaxxing is a fork of NVIDIA NemoClaw (sandboxed OpenClaw agents on OpenShell) carrying an enterprise overlay that realizes the "Sovereign Agentic Factory" whitepaper: secure, stateful, multi-agent systems on Microsoft Azure and NVIDIA infrastructure, with Azure NetApp Files as the persistent storage layer everywhere.

The philosophy, distilled from the whitepaper and corpus:

- **Trust zones, not trust assumptions.** Field agents (low trust, internet-facing) and vault agents (high trust, enterprise data) are role profiles separated by an enforcing gateway — never by convention.
- **One seam to the data.** Agents never touch PostgreSQL or the ANF document share directly; every knowledge access flows through the retrieval API boundary, which enforces role policy and document ACLs inside the SQL itself.
- **Storage is a first-class architectural layer.** ANF carries the RAG source documents, the vector store's WAL and data (on different service tiers), NIM model caches, and agent workspace state — with snapshots as the recovery and memory primitive.
- **Honesty as discipline.** Every claim carries a status (`validated` / `assumed` / `custom-build-required` / `blocked`) with evidence; aspiration and reality are never blended.

## 2. Repository Map

| Zone | Path | Owner | What lives there |
|---|---|---|---|
| Upstream core | `src/`, `bin/`, `nemoclaw/`, `nemoclaw-blueprint/`, `docs/`, `scripts/` | NVIDIA upstream | CLI, plugin, blueprint runner, sandbox hardening, user docs |
| Runtime overlay | `enterprise/services/` | This project | retrieval-api, gateway, console, mcp-bridge (all dependency-free Node 22 TypeScript) |
| Ingestion overlay | `enterprise/workers/nemo-retriever-ingest/` | This project | Python NeMo Retriever worker writing into pgvector |
| Deployment | `enterprise/deploy/` | This project | Bicep (VNet, ANF, AKS GPU, Key Vault), numbered k8s manifests, staged scripts |
| Program kit | `incubator/enterprise-azure-anf/` | This project | specs 00-18, ADRs, corpus derivatives, profiles, example manifests, runbooks, plans, this review |
| Public surface | `site/`, `artifacts/enterprise-azure-anf/` | This project | GitHub Pages site, whitepaper PDF, architecture boards |
| Agent operability | `.agents/skills/nemomaxxing-*`, `.agents/skills/nemoclaw-contributor-enterprise-*` | This project | Skills that let an agent deploy and operate the platform |
| Tests | `test/enterprise-*.test.ts`, `test/nemomaxxing-*.test.ts` | This project | 25 files covering services, manifests, workflows, skills, and control surfaces |

## 3. Review Findings: What Was Good, What Was Broken

### 3.1 What was genuinely good on arrival

- The retrieval API design: role profiles instead of new runtimes (ADR-005), policy resolution before backend access, hybrid dense-plus-FTS retrieval fused with reciprocal rank fusion, injectable NIM clients matching documented request contracts.
- Clean fork-plus-overlay governance (ADR-001, spec 12): overlay zones never touch upstream zones, keeping NVIDIA syncs viable.
- The program-control discipline: logbook, tracker, backlog, and change-control rules that made this review tractable and this report writable.
- Corpus provenance: contradictions between whitepaper drafts are recorded in a graph instead of silently resolved.

### 3.2 What was broken (all fixed; see section 4)

The unifying root cause: **the runtime had been designed and contract-tested, but never executed against real infrastructure.** Mocked tests validated shapes, not behavior. The first live run against a real PostgreSQL surfaced every one of these:

| Defect | Root cause |
|---|---|
| Sixteen of nineteen architecture specs missing; repo tests failing | a generic `specs/` rule in `.gitignore` silently swallowed the incubator spec directory |
| The vector schema could never build its HNSW index | `vector(3072)` exceeds pgvector's 2000-dimension HNSW cap and mismatched the 1024-dim default embedding model |
| `npm start` and `npm run bootstrap` never ran | Node strip-types requires explicit `.ts` import extensions; all imports were extensionless |
| Embeddings rejected by PostgreSQL | JS arrays and Python lists serialize as `{...}` array literals; the `vector` type requires `[...]` |
| The verification harness could never pass | it checked index names the migration never creates |
| All skills and docs referenced `/Users/dwirefs/...` | authored on one machine, never made portable |
| Anyone could read any ACL'd document | principals were asserted by the caller and trusted (fixed by the gateway) |

## 4. The Build Waves: What, Why, How, Where

### 4.1 Wave 1 — Repair and prove the spine (2026-06-12)

**What:** reconstructed specs 00-14 and 18 from in-repo sources with provenance notes; scoped the `.gitignore` rule; fixed the five live-path defects; added a `schema_migrations` ledger; content-addressed chunk ids (SHA-256 of source and content) for duplicate-safe re-ingestion; landed ACL-aware retrieval (migration `002_acl_principals.sql`, GIN index, SQL predicate inside both retrieval CTEs before rank fusion, policy-level principal stripping for sanitized-only roles); built the repeatable e2e harness and the CI workflow running it against a real pgvector service container.

**Why:** nothing downstream (UI, deployment, agents) is trustworthy until the retrieval spine demonstrably works and enforces its security model against a live database.

**Where:** `enterprise/services/retrieval-api/` (schema, planner, backend, scripts), `enterprise/workers/nemo-retriever-ingest/src/postgres_writer.py`, `.github/workflows/enterprise-retrieval-e2e.yaml`, `incubator/enterprise-azure-anf/specs/`.

**How it is proven:** `npm run bootstrap` → `npm run verify:postgres` → `npm run e2e:local` against PostgreSQL 16 + pgvector 0.8.2; four role/ACL enforcement checks over HTTP; the same flow runs in CI on every enterprise change.

### 4.2 Wave 2 — Make it a deployable platform (2026-06-12)

**What:** the NemoMaxxing console (`enterprise/services/console/` — grounded chat with numbered citations through the boundary, plus a retrieval inspector that makes policy and ACL decisions visible); the deployment tree (`enterprise/deploy/` — Bicep for VNet with ANF-delegated subnet, ANF account/pools/volumes including split `pg-wal` Ultra and `pg-data` Premium, AKS with GPU pool and workload identity, Key Vault; numbered k8s manifests for PostgreSQL, RAG NIMs, Nemotron 253B with the 70B cost-down swap, Gemma on vLLM and SGLang, nv-ingest against the ANF share, retrieval API with hard-gated bootstrap/verify jobs, console, worker tier; staged scripts with readiness gates); four `nemomaxxing-*` agent skills encoding the deployment runbook.

**Why:** the whitepaper promises an end-to-end factory; a validated retrieval slice is not one. The console exists (rather than adopting a stock RAG frontend) because the differentiators — field/vault roles, principals, ACL visibility — need first-class controls. The OpenAI-compatible chat contract means one console path serves Nemotron NIM, vLLM, and SGLang identically.

**Honest status:** the console is `validated` (live e2e locally and in CI); the cloud assets are `assumed` — structurally tested, never applied to a real subscription. The first `az deployment` run is the next validation event.

### 4.3 Wave 3 — Close the security architecture (2026-07-03)

**What:** the secure gateway (`enterprise/services/gateway/`) — bearer authentication in static and RS256-JWT/JWKS modes (Entra ID pattern, pure `node:crypto`), identity-derived principals with body-principal discarding, redaction and masking of sanitized-only responses, JSONL audit trail with SHA-256 query hashes, per-subject token-bucket rate limiting, Prometheus metrics; the MCP-to-ANF bridge (`enterprise/services/mcp-bridge/`) — a stdio MCP server exposing `retrieval_search` and `retrieval_health`, principals deliberately excluded from tool arguments; production hardening (liveness/readiness split, request body caps, graceful SIGTERM draining); the k8s NetworkPolicy making the retrieval API reachable only from the gateway.

**Why:** these were the two largest promised-but-missing links from the whitepaper. The gateway converts ACL *enforcement* into *authenticated* enforcement — before it, any caller could assert any principal. The MCP bridge makes the boundary consumable by any agent runtime natively.

**How it is proven:** nine gateway e2e checks and five bridge e2e checks against the live stack, all also in CI. The decisive checks: an identity's group claims unlock an ACL-restricted chunk with no principals in the request body, and body-supplied principals fail to escalate.

## 5. Architecture Inputs

### 5.1 The trust chain as built

```text
human ──> console ─┐
                   ├─ Bearer ──> gateway ──> retrieval API ──> PostgreSQL+pgvector (ANF)
agent ──> MCP bridge┘             │                │
                             auth, principals,   role policy, collection filter,
                             redaction, audit,   ACL predicate inside SQL,
                             rate limit          hybrid RRF + rerank
```

Every consumer surface passes through one audited, redacting, rate-limited boundary; the NetworkPolicy makes bypass impossible at the network layer. This is the strongest structural property the platform now has — preserve it in every future change.

### 5.2 Invariants future work must not break

1. Principals never travel in a request body past the gateway; they are derived from verified identity only.
2. The embedding dimension (`vector(1024)`) is coupled to the default embedding model; changing the model is a coordinated migration, and anything above 2000 dimensions requires a `halfvec` index strategy.
3. Embeddings cross the wire as pgvector text literals (`[...]`) with explicit `::vector` casts — in TypeScript and Python both.
4. All relative imports in the services carry explicit `.ts` extensions (Node strip-types requirement); the CI typecheck enforces this.
5. The ACL predicate runs inside both retrieval CTEs before rank fusion, so restricted content never enters ranking for unauthorized requests.
6. Services stay dependency-free (only `pg` in the retrieval API) unless an ADR justifies otherwise; the audit, JWT, metrics, and MCP implementations prove the platform surface is sufficient.

### 5.3 Recommended architecture changes (my inputs)

1. **Split policy from execution in the retrieval API.** Policy resolution currently lives in the same service as query execution. As collections multiply, extract the policy model into a declarative document (the profiles YAML already points this way) so the gateway and retrieval API share one policy source instead of two hardcodings.
2. **Upgrade the gateway to the MCP 2026-07-28 authorization model.** The new MCP spec formalizes servers as OAuth 2.1 resource servers with audience-bound tokens (RFC 8707/9728). The gateway's JWT mode is 80% of the way there; add resource-indicator validation and protected-resource metadata, and the MCP bridge becomes spec-conformant for enterprise clients.
3. **Adopt per-request identity propagation end to end.** The gateway already stamps `x-request-id` downstream; extend the audit correlation into the retrieval API's logs so one id traces console → gateway → SQL.
4. **Plan the ANF volume map to include a KV-cache tier.** See section 6.1 — this is the largest architectural opportunity the research surfaced.
5. **Row-level security as ratchet, not replacement.** The application-level ACL predicate is index-friendly and proven; PostgreSQL RLS can be layered underneath later as defense in depth (mind the LEAKPROOF caveat in spec 14) once the principal model stabilizes.

## 6. Foresight: Industry Trends And The Features They Justify

Research current as of July 2026; sources named in the tracker's currency notes.

### 6.1 ANF as inference memory — the headline opportunity

NVIDIA has standardized KV-cache offload to networked storage (Dynamo 1.0 with KV-aware routing, NIXL as the transfer layer, the ICMSP reference with BlueField-4), and NetApp announced the AI Data Engine co-engineered with NVIDIA plus support for the STX rack architecture with a dedicated KV-cache memory tier. Reported industry results: order-of-magnitude time-to-first-token reductions when reusing cached context from shared storage.

For this project that means ANF graduates from "where the documents and vectors live" to **"where inference context memory lives."** Proposed feature: a `kv-cache` ANF volume in the Bicep module and a Dynamo-fronted serving profile in the manifests, so long agent sessions and repeated enterprise contexts (the same policy documents grounding thousands of queries) stop re-prefilling. This is also the single best blog angle for "NemoMaxxing": the storage layer literally becomes part of the model's memory hierarchy.

### 6.2 Agentic retrieval, sequenced correctly

The 2026 production consensus: make hybrid retrieval plus reranking excellent before layering agentic patterns — "an agent that loops over a weak retriever spends more money to be wrong." This validates the project's sequencing. Next steps in order: (1) enable `hnsw.iterative_scan = relaxed_order` for ACL-filtered recall and `halfvec` storage; (2) a retrieval-quality harness (RAGAS-style faithfulness and context precision) wired to the benchmarking runbook; (3) only then an agentic retrieval mode — a router in the retrieval API that can decompose a query, issue multiple searches, and merge with provenance. GraphRAG becomes a candidate when cross-document relational questions dominate; it would be a new backend behind the same boundary, not a new boundary.

### 6.3 Agent interop and identity

A2A reached v1.0 under the Linux Foundation with signed Agent Cards and GA support across Azure AI Foundry and Copilot Studio; MCP's 2026-07-28 authorization spec is the largest revision since launch; agent identity is converging on SPIFFE-style workload identity with Entra Agent ID early implementations. Features this justifies: an A2A Agent Card for the vault-agent service (making the field→vault handoff from the whitepaper's manufacturing scenario a standards-based exchange), OAuth 2.1 resource-server semantics in the gateway (section 5.3), and SPIFFE/workload-identity issuance for the worker tier replacing static tokens.

### 6.4 Memory architectures

The agent-memory market (Mem0, Letta, Zep, LangMem) offers semantic and episodic layers, but none offer what ANF has natively: **filesystem-level, versioned, sub-second snapshot rollback of complete agent state.** Feature: formalize snapshot-as-memory — scheduled ANF snapshots of the agent-workspace volume, a restore command in the worker-tier tooling, and an episodic-memory table in PostgreSQL so semantic memory (pgvector), episodic memory (SQL), and state memory (ANF snapshots) compose. This is a genuine differentiator; the whitepaper already sketched it.

### 6.5 Safety and compliance

EU AI Act enforcement powers begin August 2, 2026; prompt injection remains unsolved industry-wide (sophisticated attackers bypass best defenses roughly half the time), making layered architectural defense the only credible posture. The platform's structure — least-privilege roles, ACL-aware retrieval, redaction, full audit — is the right shape. Features to add: NeMo Guardrails (now operator-managed, with NemoGuard NIM jailbreak/injection detection) as the retrieval rail on the agent path; content-attribution in console answers (which passages produced which sentence); and an audit-export runbook mapping the gateway's JSONL trail to AI-Act logging obligations.

### 6.6 Confidential and sovereign computing

Azure confidential H100 VMs are GA (HBM encryption, keys never leave the GPU) and Blackwell adds NVLink encryption; NVIDIA's "Sovereign AI Factory" reference messaging matches this project's name and design almost exactly. Feature: a confidential-compute deployment variant in the Bicep (NCC-class GPU pool) and a sovereignty section in the site — data residency on ANF, confidential inference, private networking — positioning NemoMaxxing as an implementation of the sovereign pattern rather than an echo of it.

### 6.7 GPU vector search — deliberately deferred

cuVS/CAGRA delivers dramatic gains at billion-scale or high-batch workloads, and EDB's `pgpu` extension brings cuVS-accelerated index builds to Postgres via VectorChord. But at typical enterprise corpus scale (millions of chunks), CPU HNSW with pgvector 0.8.x remains the right call, and ADR-003 stands. The tracker carries this as a benchmark-gated decision: revisit only if corpus size or batch QPS crosses the hundred-million regime, via an ADR-007.

## 7. Prioritized Resume-Work Plan

### First session back (no cloud needed)

1. Read this report, then `specs/15` → `16` → `17` for current status.
2. Run the full local proof to reacquaint: bootstrap → verify → the four e2e suites (retrieval, console, gateway, MCP bridge). Every command is in the service READMEs.
3. Review and merge PR #3 — it contains all three waves and is fully green.

### First week (Azure subscription in hand)

1. Execute `nemomaxxing-deploy-azure-infra` then `nemomaxxing-deploy-platform` (the skills are the runbook). The first real deployment is the validation event for everything marked `assumed`.
2. Validate gateway JWT mode against your real Entra tenant (app registration, groups claim, roles claim).
3. Run the ingestion worker against real documents on the ANF share; upgrade the nv-ingest pin from `release/26.03` toward current and add Parquet NA-sanitization.
4. Benchmark PostgreSQL on the split ANF volumes per spec 10 and record acceptance-gate results.

### First quarter (feature waves, in dependency order)

1. Retrieval quality: iterative scans + halfvec + RAGAS harness (6.2).
2. Identity completion: OAuth 2.1/MCP-spec gateway, workload identity for the worker tier, automatic ACL capture from ANF share permissions (6.3, the remaining half of the ACL story).
3. Guardrails rail + answer attribution (6.5).
4. Snapshot-as-memory formalization (6.4).
5. KV-cache-on-ANF experiment with Dynamo-served NIMs (6.1) — the flagship blog material.
6. A2A Agent Card + field→vault handoff demo reproducing the whitepaper's manufacturing scenario end to end.

## 8. Validation Evidence Ledger

| Proof | Where | Last result |
|---|---|---|
| Schema bootstrap, migration ledger, HNSW/FTS/ACL indexes | `retrieval-api npm run bootstrap` + `verify:postgres` | pass, live PostgreSQL 16 + pgvector 0.8.2 |
| Role and ACL enforcement over HTTP | `retrieval-api npm run e2e:local` (4 checks) | pass, local and CI |
| Grounded chat + ACL inspector | `console npm run e2e:local` (4 checks) | pass, local and CI |
| Authentication, anti-escalation, redaction, audit, rate limit, metrics | `gateway npm run e2e:local` (9 checks) | pass, local and CI |
| MCP protocol + tools over live stack | `mcp-bridge npm run e2e:local` (5 checks) | pass, local and CI |
| Full repo suite | `npm test` | 3,100+ tests green; PR #3 all checks green |
| Deployment assets | structural tests only | `assumed` until first real `az deployment` |

## 9. Provenance

Authored 2026-07-03 by the reviewing agent ("Fable" per the project owner's request) from: the full repository source, the Sovereign Agentic Factory whitepaper and architecture boards in `artifacts/`, the incubator corpus derivatives and ADRs, the reconstructed spec set, live end-to-end execution evidence recorded in the logbook, and July-2026 web research (NVIDIA Dynamo/NIXL/ICMSP and NetApp AIDE announcements, cuVS and EDB pgpu, Linux Foundation A2A 1.0, the MCP 2026-07-28 authorization RC, Azure confidential H100 GA, EU AI Act implementation timeline, and current agentic-RAG production guidance). Statuses follow the tracker vocabulary; anything not marked `validated` should be treated as unproven until its validation event is logged.
