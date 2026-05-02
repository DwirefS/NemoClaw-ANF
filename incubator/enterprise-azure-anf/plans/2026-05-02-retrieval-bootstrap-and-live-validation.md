<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Retrieval Bootstrap And Live Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the deployment-time retrieval bootstrap flow and the first repo-owned live-validation surfaces for the PostgreSQL-backed enterprise retrieval path.

**Architecture:** The retrieval package already owns schema discovery and bootstrap logic. This plan makes that capability deployable by adding an explicit bootstrap job manifest, a small smoke-validation surface, and tests that tie the deployment bundle back to the repo-owned retrieval API package and its pgvector database contract.

**Tech Stack:** TypeScript, Node.js, Vitest, YAML manifests, PostgreSQL, project-owned deployment assets

---

## File Structure

**Create**

- `incubator/enterprise-azure-anf/manifests/retrieval-bootstrap-job.yaml`
- `enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs`
- `test/enterprise-retrieval-bootstrap-job.test.ts`
- `test/enterprise-retrieval-smoke-script.test.ts`

**Modify**

- `enterprise/services/retrieval-api/package.json`
- `enterprise/services/retrieval-api/README.md`
- `incubator/enterprise-azure-anf/manifests/retrieval-api.yaml`
- `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

---

### Task 1: Add a failing test for the deployment-time bootstrap job

**Files:**
- Create: `test/enterprise-retrieval-bootstrap-job.test.ts`
- Create: `incubator/enterprise-azure-anf/manifests/retrieval-bootstrap-job.yaml`

- [ ] **Step 1: Write the failing manifest test**

Create a focused test that requires an explicit bootstrap job manifest instead of leaving migration timing implicit.

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = resolve(
  import.meta.dirname,
  "..",
  "incubator/enterprise-azure-anf/manifests/retrieval-bootstrap-job.yaml",
);

describe("retrieval bootstrap job manifest", () => {
  it("runs the retrieval bootstrap command against PostgreSQL", () => {
    const yaml = readFileSync(manifestPath, "utf8");
    expect(yaml).toContain("kind: Job");
    expect(yaml).toContain("retrieval-bootstrap");
    expect(yaml).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(yaml).toContain("npm run bootstrap");
    expect(yaml).toContain("restartPolicy: OnFailure");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-retrieval-bootstrap-job.test.ts`

Expected: FAIL because the job manifest does not exist yet

- [ ] **Step 3: Add the bootstrap job manifest**

Create a job manifest that uses the retrieval API image to apply migrations before the service is considered ready.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: retrieval-bootstrap
  namespace: rag-platform
spec:
  backoffLimit: 4
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: bootstrap
          image: ghcr.io/dwirefs/nemoclaw-anf/retrieval-api:dev
          command: ["sh", "-lc", "npm run bootstrap"]
          env:
            - name: RETRIEVAL_API_DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: retrieval-api-secrets
                  key: databaseUrl
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-retrieval-bootstrap-job.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/enterprise-retrieval-bootstrap-job.test.ts incubator/enterprise-azure-anf/manifests/retrieval-bootstrap-job.yaml
git commit -m "feat(retrieval): add bootstrap job manifest"
```

### Task 2: Wire the retrieval package and deployment docs to the bootstrap flow

**Files:**
- Modify: `enterprise/services/retrieval-api/package.json`
- Modify: `enterprise/services/retrieval-api/README.md`
- Modify: `incubator/enterprise-azure-anf/manifests/retrieval-api.yaml`

- [ ] **Step 1: Write the failing documentation and manifest test**

Extend the test to require bootstrap sequencing notes and an explicit relationship between the bootstrap job and the retrieval service.

```ts
it("documents the bootstrap dependency for the retrieval service", () => {
  const serviceYaml = readFileSync(
    resolve(import.meta.dirname, "..", "incubator/enterprise-azure-anf/manifests/retrieval-api.yaml"),
    "utf8",
  );

  const readme = readFileSync(
    resolve(import.meta.dirname, "..", "enterprise/services/retrieval-api/README.md"),
    "utf8",
  );

  expect(serviceYaml).toContain("retrieval-bootstrap");
  expect(readme).toContain("Run the bootstrap job before the retrieval API deployment");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/enterprise-retrieval-bootstrap-job.test.ts`

Expected: FAIL because the retrieval service manifest and README do not mention the bootstrap flow yet

- [ ] **Step 3: Update the package and deployment docs**

Keep the package bootstrap script explicit and document the required deployment sequence.

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "bootstrap": "node dist/bootstrap.js",
    "test": "vitest run"
  }
}
```

```md
## Database Bootstrap

Run the bootstrap job before the retrieval API deployment points at a fresh PostgreSQL instance.

The bootstrap flow applies the SQL files under `sql/` through the package-owned migration runner:

```bash
npm run build
npm run bootstrap
```
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-retrieval-bootstrap-job.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add enterprise/services/retrieval-api/package.json enterprise/services/retrieval-api/README.md incubator/enterprise-azure-anf/manifests/retrieval-api.yaml
git commit -m "docs(retrieval): document bootstrap sequencing"
```

### Task 3: Add a repo-owned smoke validation script for bootstrap readiness

**Files:**
- Create: `enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs`
- Create: `test/enterprise-retrieval-smoke-script.test.ts`

- [ ] **Step 1: Write the failing test for the smoke script**

Create a test that requires a simple repo-owned bootstrap readiness check.

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retrieval smoke bootstrap script", () => {
  it("checks the required environment variables and prints a readiness summary", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "..", "enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs"),
      "utf8",
    );
    expect(script).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(script).toContain("Embedding endpoint");
    expect(script).toContain("Reranker endpoint");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-retrieval-smoke-script.test.ts`

Expected: FAIL because the smoke script does not exist yet

- [ ] **Step 3: Add the smoke script**

Implement a small Node script that prints the readiness of the required environment values without touching the live database.

```js
// enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs
const required = [
  ["RETRIEVAL_API_DATABASE_URL", process.env.RETRIEVAL_API_DATABASE_URL],
  ["RETRIEVAL_API_EMBEDDING_URL", process.env.RETRIEVAL_API_EMBEDDING_URL],
  ["RETRIEVAL_API_RERANKER_URL", process.env.RETRIEVAL_API_RERANKER_URL],
];

for (const [name, value] of required) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

console.log("Embedding endpoint:", process.env.RETRIEVAL_API_EMBEDDING_URL);
console.log("Reranker endpoint:", process.env.RETRIEVAL_API_RERANKER_URL);
console.log("Bootstrap smoke check complete.");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-retrieval-smoke-script.test.ts`

Expected: PASS

Run: `node enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs`

Expected: FAIL with a missing environment variable message until the environment is supplied

- [ ] **Step 5: Commit**

```bash
git add enterprise/services/retrieval-api/scripts/smoke-bootstrap.mjs test/enterprise-retrieval-smoke-script.test.ts
git commit -m "feat(retrieval): add bootstrap smoke validation"
```

### Task 4: Update the program control surfaces and run the focused verification suite

**Files:**
- Modify: `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- Modify: `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- Modify: `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

- [ ] **Step 1: Update the tracker and backlog entries for bootstrap deployment**

Record that the bootstrap surface has moved from “concept” to “repo-owned deployment asset,” while keeping live cluster validation as a separate remaining item.

```md
| Retrieval schema bootstrap job | `validated` | The deployment bundle now contains a bootstrap job manifest tied to the package-owned migration runner. | bootstrap job manifest, tests | Validate against a live cluster deployment |
```

- [ ] **Step 2: Append a logbook entry for the bootstrap deployment pass**

Use the logbook to record:

- the new manifest
- the smoke script
- any manifest or deployment-sequencing mismatches that were corrected

- [ ] **Step 3: Run the focused verification suite**

Run: `npx vitest run test/enterprise-retrieval-bootstrap-job.test.ts test/enterprise-retrieval-smoke-script.test.ts test/enterprise-retrieval-bootstrap.test.ts test/enterprise-retrieval-migrations.test.ts`

Expected: PASS

Run: `npx vitest run --project cli test/enterprise-retrieval-bootstrap-job.test.ts test/enterprise-retrieval-smoke-script.test.ts test/enterprise-retrieval-bootstrap.test.ts test/enterprise-retrieval-migrations.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add incubator/enterprise-azure-anf/specs/15-engineering-tracker.md incubator/enterprise-azure-anf/specs/16-program-logbook.md incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md
git commit -m "docs(retrieval): update bootstrap status tracking"
```
