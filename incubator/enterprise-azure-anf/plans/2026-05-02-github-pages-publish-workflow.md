<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# GitHub Pages Publish Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the project-owned `site/` surface and the repo-root `artifacts/enterprise-azure-anf/` store together through GitHub Pages without using the upstream NemoClaw `docs/` tree.

**Architecture:** A dedicated GitHub Actions workflow assembles a Pages publish directory from two sources: `site/` becomes the published site root, and `artifacts/enterprise-azure-anf/` is copied into the published output under `artifacts/enterprise-azure-anf/`. A focused test asserts the workflow exists and references the required Pages actions and copy behavior. The tracker, logbook, and backlog then record that publish automation exists in-repo while GitHub repository settings still need to point Pages at Actions.

**Tech Stack:** GitHub Actions, static site files, shell copy steps, Vitest, project-owned overlay specs

---

## File Structure

**Create**

- `.github/workflows/enterprise-site-pages.yml`
- `test/enterprise-site-publish-workflow.test.ts`

**Modify**

- `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

---

### Task 1: Add a failing test for the Pages workflow

**Files:**
- Create: `test/enterprise-site-publish-workflow.test.ts`

- [ ] **Step 1: Write the failing workflow test**

Create a focused test that requires a dedicated Pages workflow for the enterprise site.

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  import.meta.dirname,
  "..",
  ".github/workflows/enterprise-site-pages.yml",
);

describe("enterprise site pages workflow", () => {
  it("publishes the site root and repo-owned artifacts through Pages", () => {
    const yaml = readFileSync(workflowPath, "utf8");
    expect(yaml).toContain("actions/configure-pages");
    expect(yaml).toContain("actions/upload-pages-artifact");
    expect(yaml).toContain("actions/deploy-pages");
    expect(yaml).toContain("site/");
    expect(yaml).toContain("artifacts/enterprise-azure-anf/");
    expect(yaml).toContain(".nojekyll");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site-publish-workflow.test.ts`

Expected: FAIL because the workflow does not exist yet

### Task 2: Add the GitHub Pages workflow

**Files:**
- Create: `.github/workflows/enterprise-site-pages.yml`

- [ ] **Step 1: Implement the workflow**

Create a workflow that:

- triggers on pushes to `main` and on `workflow_dispatch`
- configures Pages permissions
- assembles a temporary publish directory
- copies `site/` contents into the publish root
- copies `artifacts/enterprise-azure-anf/` into the publish root under `artifacts/enterprise-azure-anf/`
- adds `.nojekyll`
- uploads the Pages artifact
- deploys it through the standard Pages deploy action

```yaml
name: Enterprise Site Pages

on:
  workflow_dispatch:
  push:
    branches: ["main"]
    paths:
      - "site/**"
      - "artifacts/enterprise-azure-anf/**"
      - ".github/workflows/enterprise-site-pages.yml"

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: enterprise-site-pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Assemble Pages artifact
        run: |
          rm -rf .enterprise-pages
          mkdir -p .enterprise-pages
          cp -R site/. .enterprise-pages/
          mkdir -p .enterprise-pages/artifacts/enterprise-azure-anf
          cp -R artifacts/enterprise-azure-anf/. .enterprise-pages/artifacts/enterprise-azure-anf/
          touch .enterprise-pages/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .enterprise-pages

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Run the workflow test to verify it passes**

Run: `npx vitest run test/enterprise-site-publish-workflow.test.ts`

Expected: PASS

### Task 3: Update the program control surfaces

**Files:**
- Modify: `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- Modify: `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- Modify: `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

- [ ] **Step 1: Update the engineering tracker**

Record that the publish workflow exists in-repo, while Pages settings still need to be configured to use Actions.

```md
| Public site publish workflow | `validated` | A dedicated GitHub Pages workflow now assembles the `site/` root and repo-owned artifact store into one publish artifact. | workflow YAML, workflow test | Switch repository Pages settings to GitHub Actions if still set to branch deploy |
```

- [ ] **Step 2: Append a logbook entry**

Add an entry describing:

- the new workflow
- the assembled publish root
- the explicit copy of `artifacts/enterprise-azure-anf/`
- the fact that GitHub repository settings may still need a manual switch from branch deploy to Actions

- [ ] **Step 3: Update the backlog**

Move the Pages workflow from `next` to `done`, and add a follow-up note for the repository settings switch if still required.

### Task 4: Run the focused verification suite

**Files:**
- No new files beyond the workflow and tracker updates

- [ ] **Step 1: Run the focused test suite**

Run: `npx vitest run test/enterprise-site.test.ts test/enterprise-site-publish-workflow.test.ts test/enterprise-azure-anf-incubator.test.ts test/enterprise-program-control.test.ts`

Expected: PASS

- [ ] **Step 2: Run a local publish assembly smoke check**

Run:

```bash
rm -rf .enterprise-pages && \
mkdir -p .enterprise-pages && \
cp -R site/. .enterprise-pages/ && \
mkdir -p .enterprise-pages/artifacts/enterprise-azure-anf && \
cp -R artifacts/enterprise-azure-anf/. .enterprise-pages/artifacts/enterprise-azure-anf/ && \
touch .enterprise-pages/.nojekyll && \
test -f .enterprise-pages/index.html && \
test -f .enterprise-pages/artifacts/enterprise-azure-anf/sovereign-agentic-factory.pdf
```

Expected: command exits successfully
