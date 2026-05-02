<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Engineering Tracker

This tracker converts the broader observations log into implementation-oriented status items that can be revisited as the overlay evolves.

For chronology, remaining work, and execution discipline, also use:

- `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`
- `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`

## Status Vocabulary

Status vocabulary for this tracker:

- `validated`
  - supported by current repo implementation, upstream source evidence, or both
- `assumed`
  - currently treated as working direction, but not yet strongly validated in this repo
- `custom-build-required`
  - intentional project-specific work that is not delivered by upstream out of the box
- `blocked`
  - cannot be responsibly marked complete until another system, dependency, or design decision is in place

## Active Tracker

| Item | Status | Why it has this status | Current evidence | Next action |
|---|---|---|---|---|
| Hybrid baseline topology | `validated` | The incubator, ADRs, and current repo strategy all treat AKS for the RAG plane plus worker-tier NemoClaw/OpenShell as the supported baseline. | Hybrid baseline specs, repo strategy, role profiles, manifests | Keep future AKS-agent work isolated as appendix or experimental |
| Retrieval API boundary | `validated` | The retrieval service now exists as project-owned runtime code and is explicitly the enterprise seam between the agent plane and the RAG plane. | `enterprise/services/retrieval-api/`, tests, incubator manifests | Expand the live backend path while preserving the boundary |
| NVIDIA NIM request contracts | `validated` | Embedding, reranking, and Nemotron chat payloads are encoded in the overlay and validated by tests. | `src/nvidia.ts`, alignment tests | Keep model and endpoint compatibility current with upstream docs |
| NIM Operator deployment pattern | `validated` | The incubator now uses `NIMCache` and `NIMService` examples aligned to the official Operator model. | `nim-services.yaml`, official source map | Tighten manifests as concrete cluster assumptions become fixed |
| Stable NeMo Retriever branch and pipeline shape | `validated` | The ingest manifest reflects the documented `release/26.03` branch and chainable extraction flow. | `nv-ingest-trigger.yaml`, alignment tests | Replace example job script with a production worker implementation |
| Program control surfaces | `validated` | The project now has a logbook, dependency backlog, change-control rules, and an execution-control skill wired into repo tests. | specs 16-18, execution-control skill, program-control tests | Keep these updated after each meaningful implementation pass |
| Public site and artifact publishing design | `validated` | The public site boundary, asset model, disclosure rules, and information architecture are now specified in a project-owned design document, and the local `site/` scaffold plus deep-dive pages and artifact store now exist in the repo. | spec 19, approved site boundary decision, site scaffold, artifact store | Add the GitHub Pages publish workflow when deployment automation is introduced |
| Public site publish workflow | `validated` | A dedicated GitHub Pages workflow now assembles the `site/` root and repo-owned artifact store into one publish artifact. | workflow YAML, workflow test | Switch repository Pages settings to GitHub Actions if still set to branch deploy |
| PostgreSQL plus pgvector retrieval store | `custom-build-required` | This is a deliberate overlay choice rather than NVIDIA’s stock RAG default, so schema, indexing, ingestion writes, and retrieval logic are ours to own. | `pgvector` schema, backend, planner, deployment bootstrap assets, observations log | Finish live DB validation, ingestion writes, and benchmark path |
| Retrieval schema bootstrap runner | `validated` | The retrieval package now owns a stable SQL migration discovery and bootstrap entrypoint, and the incubator deployment bundle now includes a bootstrap job manifest that uses the same package contract. | `src/migrations.ts`, `src/bootstrap.ts`, `retrieval-bootstrap-job.yaml`, bootstrap tests | Exercise the bootstrap job against a real PostgreSQL deployment |
| Retrieval bootstrap readiness smoke validation | `validated` | The retrieval package now includes a repo-owned script that checks the required bootstrap environment contract without touching the live database. | `scripts/smoke-bootstrap.mjs`, smoke-script test | Expand into live connectivity validation once cluster endpoints are available |
| Hybrid dense plus sparse retrieval logic | `custom-build-required` | The planner and backend exist, but we still own recall tuning, query shaping, and production hardening. | `src/pgvector.ts`, `src/pgvector-backend.ts`, tests | Add reranking stage integration and benchmark harness |
| Live PostgreSQL verification harness | `validated` | The retrieval package now exposes a package-owned verification script and an incubator verification job manifest tied to the same DSN contract as bootstrap and service startup. | `scripts/verify-live-postgres.mjs`, `package.json`, `retrieval-postgres-verify-job.yaml`, verification tests | Run the harness against a real PostgreSQL deployment on the target platform |
| Live PostgreSQL bootstrap from service config | `assumed` | The backend factory, bootstrap runner, deployment-time job manifest, smoke script, and verification harness now support a `pgvector` mode end to end, but the flow has not yet been exercised against a real cluster database in this repo. | `src/backend-factory.ts`, `src/index.ts`, `retrieval-bootstrap-job.yaml`, `retrieval-postgres-verify-job.yaml`, `scripts/smoke-bootstrap.mjs`, `scripts/verify-live-postgres.mjs`, bootstrap and verification tests | Validate with an actual PostgreSQL deployment and migration flow |
| Live embedding NIM integration | `assumed` | The HTTP client is implemented and tested against mocked NIM responses, but not yet validated against a deployed embedding NIM in this repo. | `src/nim-http.ts`, client tests | Run against a live embedding NIM and capture compatibility notes |
| Live reranker NIM integration | `assumed` | The HTTP client exists, follows the documented ranking contract, and the live backend can consume reranking results, but it has not yet been validated against a deployed reranker NIM in this repo. | `src/nim-http.ts`, `src/pgvector-backend.ts`, client tests | Run against a live reranker NIM and evaluate ranking impact |
| Project-owned NeMo Retriever ingestion worker | `assumed` | The worker package exists, uses the documented NeMo Retriever pipeline shape, and writes into PostgreSQL, but it has not yet been validated against live documents and live NeMo Retriever output shapes. | `enterprise/workers/nemo-retriever-ingest/`, worker tests, Python compile | Run on sample corpora and validate normalized chunk output against schema |
| ANF PostgreSQL storage class profile | `assumed` | The ANF storage class now reflects a PostgreSQL-oriented NFS mount profile, but the performance choice still needs workload validation on Azure. | `storageclasses-anf.yaml`, observations log | Benchmark on target VM and ANF service levels |
| ACL-aware retrieval filtering | `blocked` | Enterprise-safe grounding depends on ANF permission capture and identity-aware filtering that are not yet implemented. | Azure reference observations, risks log | Design metadata model, identity mapping, and retrieval-time enforcement |
| Azure-native secret management alignment with runtime | `blocked` | Secret flow across AKS, worker tier, and current upstream runtime assumptions is not fully normalized yet. | risks log, hybrid baseline notes | Define supported secret path and bootstrap contract |
| ANF-backed agent memory and state | `assumed` | The incubator treats this as a valid overlay pattern, but it is not a turnkey upstream NemoClaw feature today. | storage layout docs, manifests, observations log | Validate mount, restore, and failure behavior under the worker-tier model |
| Full AKS-hosted NemoClaw/OpenShell | `blocked` | This remains more speculative than the hybrid baseline and should not be presented as the supported deployment target. | current-state architecture spec, observations log | Reassess only after upstream behavior and operator story are clearer |
