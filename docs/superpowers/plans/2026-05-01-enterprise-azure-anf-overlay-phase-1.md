<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Enterprise Azure ANF Overlay Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real project-owned runtime slice for the enterprise Azure ANF overlay by implementing a retrieval API service and wiring it into an additive deployment bundle.

**Architecture:** The implementation stays outside upstream NemoClaw core. A standalone retrieval API service lives under `enterprise/services/retrieval-api/`, enforces role-aware retrieval policy for field and vault agents, and exposes a small HTTP contract that the worker tier and AKS data plane can consume. Deployment assets and tests validate the service contract, policy boundaries, and overlay structure.

**Tech Stack:** TypeScript, Node.js HTTP server, Vitest, YAML manifests, project-owned overlay directories

---

### Task 1: Scaffold the enterprise overlay runtime surface

**Files:**
- Create: `enterprise/README.md`
- Create: `enterprise/services/retrieval-api/README.md`
- Create: `enterprise/services/retrieval-api/package.json`
- Create: `enterprise/services/retrieval-api/tsconfig.json`
- Create: `enterprise/services/retrieval-api/Dockerfile`

- [ ] **Step 1: Add the overlay root and retrieval API package metadata**

Create a small enterprise overlay surface and a standalone package descriptor for the retrieval API.

- [ ] **Step 2: Run the incubator test to confirm this task is additive only**

Run: `npx vitest run test/enterprise-azure-anf-incubator.test.ts`
Expected: PASS

### Task 2: Implement the retrieval API contract with failing tests first

**Files:**
- Create: `test/enterprise-retrieval-api.test.ts`
- Create: `enterprise/services/retrieval-api/src/contracts.ts`
- Create: `enterprise/services/retrieval-api/src/profiles.ts`
- Create: `enterprise/services/retrieval-api/src/config.ts`
- Create: `enterprise/services/retrieval-api/src/policy.ts`
- Create: `enterprise/services/retrieval-api/src/backend.ts`
- Create: `enterprise/services/retrieval-api/src/server.ts`
- Create: `enterprise/services/retrieval-api/src/index.ts`

- [ ] **Step 1: Write the failing tests for health, query validation, and role-aware policy**

Tests should cover:
- `GET /healthz` returns `200`
- `POST /v1/query` rejects malformed bodies with `400`
- `field-agent` requests are constrained to sanitized corpora
- `vault-agent` requests may access restricted corpora
- the response includes explicit policy metadata

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/enterprise-retrieval-api.test.ts`
Expected: FAIL because the retrieval API modules do not exist yet

- [ ] **Step 3: Implement the minimal retrieval API**

Implement:
- a request and response contract
- profile-derived policy enforcement
- an injectable backend interface
- a small Node HTTP server with `/healthz` and `/v1/query`
- a default in-memory backend for deterministic tests

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/enterprise-retrieval-api.test.ts`
Expected: PASS

### Task 3: Add pgvector-oriented query planning and deployment alignment

**Files:**
- Create: `test/enterprise-retrieval-query-plan.test.ts`
- Create: `enterprise/services/retrieval-api/src/pgvector.ts`
- Modify: `enterprise/services/retrieval-api/README.md`
- Modify: `incubator/enterprise-azure-anf/manifests/retrieval-api.yaml`

- [ ] **Step 1: Write the failing tests for query planning**

Tests should cover:
- generated query metadata for hybrid search
- explicit denial of direct agent database access
- inclusion of profile-limited collection filters

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/enterprise-retrieval-query-plan.test.ts`
Expected: FAIL because the query planner does not exist yet

- [ ] **Step 3: Implement the minimal pgvector query-planning module**

Implement a pure query planner that:
- builds the role-aware hybrid retrieval plan
- emits SQL text plus bound values
- keeps the database access boundary inside the service rather than the agent

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/enterprise-retrieval-query-plan.test.ts`
Expected: PASS

### Task 4: Verify the overlay slice end to end

**Files:**
- Modify: `test/enterprise-azure-anf-incubator.test.ts`

- [ ] **Step 1: Extend the incubator test to require the new runtime slice**

Add assertions for:
- `enterprise/services/retrieval-api/` existence
- retrieval API package metadata
- retrieval API README presence

- [ ] **Step 2: Run the focused test suite**

Run: `npx vitest run test/enterprise-azure-anf-incubator.test.ts test/enterprise-retrieval-api.test.ts test/enterprise-retrieval-query-plan.test.ts`
Expected: PASS

- [ ] **Step 3: Run the broader CLI project validation**

Run: `npx vitest run --project cli test/enterprise-azure-anf-incubator.test.ts test/enterprise-retrieval-api.test.ts test/enterprise-retrieval-query-plan.test.ts`
Expected: PASS
