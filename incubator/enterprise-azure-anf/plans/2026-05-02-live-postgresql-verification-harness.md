<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Live PostgreSQL Verification Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-owned live PostgreSQL verification harness for the retrieval service so operators can validate the database contract, schema presence, and `pgvector` prerequisites before the live retrieval path is exercised.

**Architecture:** The retrieval package gains a small JavaScript verification script that connects to PostgreSQL through the existing DSN contract and checks the live database for the expected extension, table, and index surfaces. The incubator deployment bundle gains a dedicated verification job manifest that runs the same package-owned script in-cluster, while the retrieval README and program-control docs record that the repo now has a real verification harness even though cluster execution is still environment-dependent.

**Tech Stack:** Node.js, `pg`, Vitest, YAML manifests, project-owned overlay specs

---

## File Structure

**Create**

- `enterprise/services/retrieval-api/scripts/verify-live-postgres.mjs`
- `incubator/enterprise-azure-anf/manifests/retrieval-postgres-verify-job.yaml`
- `test/enterprise-retrieval-live-postgres-script.test.ts`
- `test/enterprise-retrieval-live-postgres-job.test.ts`

**Modify**

- `enterprise/services/retrieval-api/package.json`
- `enterprise/services/retrieval-api/README.md`
- `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

---

### Task 1: Add a failing test for the live PostgreSQL verification script

**Files:**
- Create: `test/enterprise-retrieval-live-postgres-script.test.ts`

- [ ] **Step 1: Write the failing test**

Create a focused test that requires a package-owned live PostgreSQL verification script.

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(
  import.meta.dirname,
  "..",
  "enterprise/services/retrieval-api/scripts/verify-live-postgres.mjs",
);

describe("retrieval live postgres verification script", () => {
  it("checks the pgvector extension and document_chunks contract", () => {
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(script).toContain("pg_extension");
    expect(script).toContain("document_chunks");
    expect(script).toContain("pgvector");
    expect(script).toContain("Verification summary");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-script.test.ts`

Expected: FAIL because the verification script does not exist yet

### Task 2: Implement the package-owned verification script

**Files:**
- Create: `enterprise/services/retrieval-api/scripts/verify-live-postgres.mjs`
- Modify: `enterprise/services/retrieval-api/package.json`

- [ ] **Step 1: Add the verification script**

Create a script that:

- reads `RETRIEVAL_API_DATABASE_URL`
- connects to PostgreSQL through `pg`
- checks whether the `vector` extension is installed
- checks whether `document_chunks` exists
- checks for the expected `document_chunks_embedding_idx` and `document_chunks_fts_idx` indexes
- prints a readable verification summary
- exits non-zero when the database contract is incomplete

```js
#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.RETRIEVAL_API_DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing required environment variable: RETRIEVAL_API_DATABASE_URL");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

const run = async () => {
  await client.connect();

  const extension = await client.query(
    "select extname from pg_extension where extname = 'vector'",
  );
  const table = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'document_chunks'",
  );
  const indexes = await client.query(
    `
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'document_chunks'
        and indexname in ('document_chunks_embedding_idx', 'document_chunks_fts_idx')
      order by indexname
    `,
  );

  const extensionReady = extension.rowCount === 1;
  const tableReady = table.rowCount === 1;
  const indexNames = indexes.rows.map((row) => row.indexname);

  console.log("Verification summary");
  console.log(`pgvector extension: ${extensionReady ? "present" : "missing"}`);
  console.log(`document_chunks table: ${tableReady ? "present" : "missing"}`);
  console.log(`Indexes present: ${indexNames.join(", ") || "<none>"}`);

  const missingIndexes = [
    "document_chunks_embedding_idx",
    "document_chunks_fts_idx",
  ].filter((name) => !indexNames.includes(name));

  if (!extensionReady || !tableReady || missingIndexes.length > 0) {
    console.error("Live PostgreSQL verification failed.");
    if (!extensionReady) {
      console.error("- pgvector extension is missing");
    }
    if (!tableReady) {
      console.error("- document_chunks table is missing");
    }
    for (const name of missingIndexes) {
      console.error(`- missing index: ${name}`);
    }
    process.exit(1);
  }

  console.log("Live PostgreSQL verification passed.");
};

run()
  .catch((error) => {
    console.error("Live PostgreSQL verification failed with an unexpected error.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
```

- [ ] **Step 2: Expose the script through package scripts**

Update `enterprise/services/retrieval-api/package.json`:

```json
{
  "scripts": {
    "start": "node --experimental-strip-types ./src/index.ts",
    "bootstrap": "node --experimental-strip-types ./src/bootstrap.ts",
    "verify:postgres": "node ./scripts/verify-live-postgres.mjs"
  }
}
```

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-script.test.ts`

Expected: PASS

- [ ] **Step 4: Run the script without a DSN to verify the failure mode**

Run: `node enterprise/services/retrieval-api/scripts/verify-live-postgres.mjs`

Expected: FAIL with `Missing required environment variable: RETRIEVAL_API_DATABASE_URL`

### Task 3: Add an incubator verification job manifest

**Files:**
- Create: `incubator/enterprise-azure-anf/manifests/retrieval-postgres-verify-job.yaml`
- Create: `test/enterprise-retrieval-live-postgres-job.test.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = resolve(
  import.meta.dirname,
  "..",
  "incubator/enterprise-azure-anf/manifests/retrieval-postgres-verify-job.yaml",
);

describe("retrieval postgres verification job manifest", () => {
  it("runs the package-owned PostgreSQL verification script", () => {
    const yaml = readFileSync(manifestPath, "utf8");
    expect(yaml).toContain("kind: Job");
    expect(yaml).toContain("retrieval-postgres-verify");
    expect(yaml).toContain("npm run verify:postgres");
    expect(yaml).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(yaml).toContain("retrieval-api-secrets");
    expect(yaml).toContain("postgres-dsn");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-job.test.ts`

Expected: FAIL because the verification manifest does not exist yet

- [ ] **Step 3: Add the verification job manifest**

```yaml
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

apiVersion: batch/v1
kind: Job
metadata:
  name: retrieval-postgres-verify
  namespace: rag
spec:
  backoffLimit: 1
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: verify-postgres
          image: ghcr.io/dwirefs/nemoclaw-anf/retrieval-api:dev
          command: ["sh", "-lc", "npm run verify:postgres"]
          env:
            - name: RETRIEVAL_API_DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: retrieval-api-secrets
                  key: postgres-dsn
```

- [ ] **Step 4: Run the manifest test to verify it passes**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-job.test.ts`

Expected: PASS

### Task 4: Document the live verification flow

**Files:**
- Modify: `enterprise/services/retrieval-api/README.md`

- [ ] **Step 1: Add a live verification section**

Add a short section after `Database Bootstrap`:

````md
## Live PostgreSQL Verification

Use the package-owned verification script before enabling live retrieval against a newly bootstrapped PostgreSQL instance.

```bash
npm run verify:postgres
```

The script checks for:

- the `vector` extension
- the `document_chunks` table
- the expected embedding and full-text indexes
````

- [ ] **Step 2: Run the focused tests to verify documentation still aligns**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-script.test.ts test/enterprise-retrieval-live-postgres-job.test.ts test/enterprise-retrieval-bootstrap-job.test.ts`

Expected: PASS

### Task 5: Update the control surfaces and run the focused verification suite

**Files:**
- Modify: `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- Modify: `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- Modify: `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

- [ ] **Step 1: Update the engineering tracker**

Record that the repo now has a package-owned live PostgreSQL verification harness even though cluster execution remains environment-dependent.

```md
| Live PostgreSQL verification harness | `validated` | The retrieval package now exposes a PostgreSQL verification script and an incubator verification job manifest tied to the same DSN contract. | verification script, package script, job manifest, tests | Run against a real PostgreSQL deployment on the target platform |
```

- [ ] **Step 2: Append the logbook entry**

Record:

- the package-owned verification script
- the incubator verification job manifest
- the choice to validate extension/table/index presence before live retrieval

- [ ] **Step 3: Update the backlog**

Move the live verification harness into `done` or equivalent repo-owned status, while keeping live cluster execution itself as the next remaining item.

- [ ] **Step 4: Run the focused verification suite**

Run: `npx vitest run test/enterprise-retrieval-live-postgres-script.test.ts test/enterprise-retrieval-live-postgres-job.test.ts test/enterprise-retrieval-bootstrap-job.test.ts test/enterprise-retrieval-smoke-script.test.ts test/enterprise-engineering-tracker.test.ts`

Expected: PASS

Run: `npx vitest run --project cli test/enterprise-retrieval-live-postgres-script.test.ts test/enterprise-retrieval-live-postgres-job.test.ts test/enterprise-retrieval-bootstrap-job.test.ts test/enterprise-retrieval-smoke-script.test.ts test/enterprise-engineering-tracker.test.ts`

Expected: PASS
