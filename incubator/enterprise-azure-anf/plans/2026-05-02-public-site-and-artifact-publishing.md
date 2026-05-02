<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Public Site And Artifact Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-owned GitHub Pages-ready `site/` surface plus a visible repo-root artifact store that explains the Enterprise Azure ANF architecture in a technically deep and visually strong way.

**Architecture:** The publishing surface stays fully outside upstream NemoClaw docs. A static `site/` tree presents the architecture through hand-authored HTML, CSS, and small JavaScript helpers, while `artifacts/enterprise-azure-anf/` holds the authoritative visible copies of the PDF and architecture boards. A focused Vitest suite protects the site structure, disclaimers, artifact visibility, and the presence of key technical claims.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Vitest, repo-owned artifact copies, project-owned overlay documentation

---

## File Structure

**Create**

- `site/README.md`
- `site/index.html`
- `site/architecture/index.html`
- `site/data-plane/index.html`
- `site/security/index.html`
- `site/storage/index.html`
- `site/use-cases/index.html`
- `site/delivery-status/index.html`
- `site/artifacts/index.html`
- `site/assets/styles/main.css`
- `site/assets/scripts/main.js`
- `site/assets/icons/README.md`
- `site/assets/icons/vendor/`
- `artifacts/enterprise-azure-anf/README.md`
- `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_25 AM (1).png`
- `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_25 AM (2).png`
- `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_37 AM (1).png`
- `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_38 AM (2).png`
- `artifacts/enterprise-azure-anf/Sovereign_Agentic_Factory.pdf`
- `test/enterprise-site.test.ts`

**Modify**

- `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

---

### Task 1: Scaffold the public site and add a failing structure test

**Files:**
- Create: `test/enterprise-site.test.ts`
- Create: `site/README.md`
- Create: `site/index.html`
- Create: `site/assets/styles/main.css`
- Create: `site/assets/scripts/main.js`

- [ ] **Step 1: Write the failing site-structure test**

Create `test/enterprise-site.test.ts` with a first pass that asserts the public site lives outside NemoClaw’s `docs/` tree and that the required root files exist.

```ts
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("enterprise public site scaffold", () => {
  it("uses a project-owned site root instead of the upstream docs tree", () => {
    expect(existsSync(resolve(root, "site/index.html"))).toBe(true);
    expect(existsSync(resolve(root, "site/assets/styles/main.css"))).toBe(true);
    expect(existsSync(resolve(root, "site/assets/scripts/main.js"))).toBe(true);
  });

  it("includes a non-affiliation disclaimer on the landing page", () => {
    const html = readFileSync(resolve(root, "site/index.html"), "utf8");
    expect(html).toContain("independent technical architecture effort");
    expect(html).toContain("not affiliated with");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: FAIL because the `site/` files do not exist yet

- [ ] **Step 3: Add the minimal site scaffold**

Create the initial site shell with a real landing page placeholder, a shared stylesheet entry, and a small navigation script.

```html
<!-- site/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NemoClaw Enterprise AI on Azure</title>
    <meta
      name="description"
      content="Independent technical architecture for NemoClaw, NVIDIA NIM, Nemotron, PostgreSQL pgvector, and Azure NetApp Files."
    />
    <link rel="stylesheet" href="/site/assets/styles/main.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="site-wordmark" href="/site/">NemoClaw Enterprise AI on Azure</a>
      <nav class="site-nav">
        <a href="/site/architecture/">Architecture</a>
        <a href="/site/data-plane/">Data Plane</a>
        <a href="/site/security/">Security</a>
        <a href="/site/storage/">Storage</a>
        <a href="/site/artifacts/">Artifacts</a>
      </nav>
    </header>
    <main class="site-shell">
      <section class="hero">
        <p class="eyebrow">Sovereign Agentic Factory</p>
        <h1>Secure, grounded enterprise AI with NemoClaw, NVIDIA NIM, Nemotron, PostgreSQL, and Azure NetApp Files.</h1>
        <p class="lede">
          This is an independent technical architecture effort and is not affiliated with, endorsed by, or sponsored by NVIDIA, Microsoft, NetApp, or PostgreSQL.
        </p>
      </section>
    </main>
    <script src="/site/assets/scripts/main.js"></script>
  </body>
</html>
```

```css
/* site/assets/styles/main.css */
:root {
  --bg: #07111f;
  --bg-soft: #0d1b2f;
  --panel: rgba(12, 27, 47, 0.82);
  --text: #f4f8ff;
  --muted: #9ab3d1;
  --azure: #3aa7ff;
  --nvidia: #76b900;
  --line: rgba(154, 179, 209, 0.24);
  --max: 1200px;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Aptos", "Segoe UI", "Helvetica Neue", sans-serif;
  background: radial-gradient(circle at top, #0c2542 0%, var(--bg) 50%, #040b14 100%);
  color: var(--text);
}
```

```js
// site/assets/scripts/main.js
document.documentElement.dataset.js = "enabled";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/enterprise-site.test.ts site/README.md site/index.html site/assets/styles/main.css site/assets/scripts/main.js
git commit -m "feat(site): scaffold public enterprise site"
```

### Task 2: Publish the visible repo-root artifact store

**Files:**
- Create: `artifacts/enterprise-azure-anf/README.md`
- Create: `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_25 AM (1).png`
- Create: `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_25 AM (2).png`
- Create: `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_37 AM (1).png`
- Create: `artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_38 AM (2).png`
- Create: `artifacts/enterprise-azure-anf/Sovereign_Agentic_Factory.pdf`
- Modify: `test/enterprise-site.test.ts`

- [ ] **Step 1: Extend the failing test to require visible artifacts**

Add assertions that the repo-root artifact store exists, contains the user-provided PNG boards, and exposes the PDF deck.

```ts
it("publishes visible architecture artifacts outside the incubator", () => {
  const artifacts = resolve(root, "artifacts/enterprise-azure-anf");
  expect(existsSync(resolve(artifacts, "README.md"))).toBe(true);
  expect(existsSync(resolve(artifacts, "ChatGPT Image May 1, 2026, 12_37_25 AM (1).png"))).toBe(true);
  expect(existsSync(resolve(artifacts, "ChatGPT Image May 1, 2026, 12_37_25 AM (2).png"))).toBe(true);
  expect(existsSync(resolve(artifacts, "ChatGPT Image May 1, 2026, 12_37_37 AM (1).png"))).toBe(true);
  expect(existsSync(resolve(artifacts, "ChatGPT Image May 1, 2026, 12_37_38 AM (2).png"))).toBe(true);
  expect(existsSync(resolve(artifacts, "Sovereign_Agentic_Factory.pdf"))).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: FAIL because the artifact store does not exist yet

- [ ] **Step 3: Copy the visible artifacts and add a README**

Create an artifact index that explains what the files are and copy the user-provided images and PDF into the repo-root store.

```md
<!-- artifacts/enterprise-azure-anf/README.md -->
<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Enterprise Azure ANF Public Artifacts

This folder holds the visible public artifacts for the Enterprise Azure ANF architecture effort.

- The PNG boards summarize the architecture, trust zones, and platform story.
- The PDF deck captures the broader sovereign agentic factory narrative.
- These files are surfaced directly from the public `site/` experience.
```

```bash
mkdir -p artifacts/enterprise-azure-anf
cp "/Users/dwirefs/Downloads/ChatGPT Image May 1, 2026, 12_37_25 AM (1).png" "artifacts/enterprise-azure-anf/"
cp "/Users/dwirefs/Downloads/ChatGPT Image May 1, 2026, 12_37_25 AM (2).png" "artifacts/enterprise-azure-anf/"
cp "/Users/dwirefs/Downloads/ChatGPT Image May 1, 2026, 12_37_37 AM (1).png" "artifacts/enterprise-azure-anf/"
cp "/Users/dwirefs/Downloads/ChatGPT Image May 1, 2026, 12_37_38 AM (2).png" "artifacts/enterprise-azure-anf/"
cp "/Users/dwirefs/Downloads/Sovereign_Agentic_Factory.pdf" "artifacts/enterprise-azure-anf/"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/enterprise-azure-anf test/enterprise-site.test.ts
git commit -m "feat(site): add public enterprise artifacts"
```

### Task 3: Build the landing page and shared design system

**Files:**
- Modify: `site/index.html`
- Modify: `site/assets/styles/main.css`
- Modify: `site/assets/scripts/main.js`
- Modify: `test/enterprise-site.test.ts`

- [ ] **Step 1: Extend the failing test to require the landing-page narrative**

Add assertions for the main technical claims and artifact visibility on the landing page.

```ts
it("explains the core stack and links to the public artifacts", () => {
  const html = readFileSync(resolve(root, "site/index.html"), "utf8");
  expect(html).toContain("Azure NetApp Files");
  expect(html).toContain("NVIDIA NIM");
  expect(html).toContain("Nemotron");
  expect(html).toContain("PostgreSQL");
  expect(html).toContain("pgvector");
  expect(html).toContain("Field Agent");
  expect(html).toContain("Vault Agent");
  expect(html).toContain("/artifacts/enterprise-azure-anf/Sovereign_Agentic_Factory.pdf");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: FAIL because the landing page is still skeletal

- [ ] **Step 3: Implement the full landing page and shared styles**

Build the landing page with:

- a strong hero
- a disclaimer band
- a technology stack garden
- a field-agent/vault-agent section
- an ANF value section
- an artifact highlight rail

```html
<section class="hero-grid">
  <div class="hero-copy">
    <p class="eyebrow">Sovereign Agentic Factory on Azure</p>
    <h1>NemoClaw Enterprise AI on Azure: secure agent execution, grounded retrieval, and stateful persistence at enterprise scale.</h1>
    <p class="lede">
      This architecture combines NemoClaw and OpenShell for secured agent runtime control, NVIDIA NIM and Nemotron for inference, PostgreSQL with pgvector for hybrid retrieval, and Azure NetApp Files for persistent state across documents, model cache, database volumes, agent memory, and recovery.
    </p>
    <div class="cta-row">
      <a class="button button-primary" href="/site/architecture/">Explore the architecture</a>
      <a class="button button-secondary" href="/artifacts/enterprise-azure-anf/Sovereign_Agentic_Factory.pdf">Open the PDF deck</a>
    </div>
  </div>
  <figure class="hero-figure">
    <img
      src="/artifacts/enterprise-azure-anf/ChatGPT Image May 1, 2026, 12_37_37 AM (1).png"
      alt="Architecture board showing the Azure NetApp Files and NVIDIA enterprise stack."
    />
  </figure>
</section>
```

```css
.hero-grid {
  max-width: var(--max);
  margin: 0 auto;
  padding: 5rem 1.5rem 3rem;
  display: grid;
  gap: 2rem;
  grid-template-columns: 1.1fr 0.9fr;
}

.button-primary {
  background: linear-gradient(135deg, var(--nvidia), #9add2d);
  color: #03110b;
}

.button-secondary {
  border: 1px solid var(--azure);
  color: var(--text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/assets/styles/main.css site/assets/scripts/main.js test/enterprise-site.test.ts
git commit -m "feat(site): build enterprise landing page"
```

### Task 4: Add the technical deep-dive pages

**Files:**
- Create: `site/architecture/index.html`
- Create: `site/data-plane/index.html`
- Create: `site/security/index.html`
- Create: `site/storage/index.html`
- Create: `site/use-cases/index.html`
- Create: `site/delivery-status/index.html`
- Create: `site/artifacts/index.html`
- Modify: `test/enterprise-site.test.ts`

- [ ] **Step 1: Extend the failing test to require the deep pages**

Add a page-presence and content-presence check for the main technical sections.

```ts
it("ships the enterprise deep-dive pages", () => {
  const pages = [
    "site/architecture/index.html",
    "site/data-plane/index.html",
    "site/security/index.html",
    "site/storage/index.html",
    "site/use-cases/index.html",
    "site/delivery-status/index.html",
    "site/artifacts/index.html",
  ];

  for (const page of pages) {
    expect(existsSync(resolve(root, page))).toBe(true);
  }

  const delivery = readFileSync(resolve(root, "site/delivery-status/index.html"), "utf8");
  expect(delivery).toContain("validated current implementation");
  expect(delivery).toContain("custom engineering still required");
  expect(delivery).toContain("ACL-aware retrieval");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: FAIL because the deep pages do not exist yet

- [ ] **Step 3: Build the deep-dive pages with real architecture content**

Each page should be a complete static page with shared navigation and page-specific content.

```html
<!-- site/security/index.html -->
<main class="page-shell">
  <section class="page-hero">
    <p class="eyebrow">Security and Trust Zones</p>
    <h1>Why the field-agent and vault-agent split matters.</h1>
    <p class="lede">
      This architecture uses NemoClaw and OpenShell as the agent control plane, but it does not treat every agent as equally trusted. Field agents work in a lower-trust zone with sanitized data and controlled retrieval. Vault agents operate in higher-trust zones with policy mediation, audit logging, redaction controls, and restricted access to sensitive enterprise corpora.
    </p>
  </section>
  <section class="content-grid">
    <article class="panel">
      <h2>OpenShell boundary</h2>
      <p>OpenShell remains the runtime boundary for network, inference, filesystem, and process policy enforcement.</p>
    </article>
    <article class="panel">
      <h2>Secure gateway</h2>
      <p>The low-trust to high-trust transition is mediated by policy checks, masking, and observable retrieval boundaries rather than unrestricted agent access.</p>
    </article>
  </section>
</main>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add site/architecture site/data-plane site/security site/storage site/use-cases site/delivery-status site/artifacts test/enterprise-site.test.ts
git commit -m "feat(site): add enterprise deep-dive pages"
```

### Task 5: Add icon provenance and final publishing checks

**Files:**
- Create: `site/assets/icons/README.md`
- Modify: `test/enterprise-site.test.ts`
- Modify: `incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
- Modify: `incubator/enterprise-azure-anf/specs/16-program-logbook.md`
- Modify: `incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`

- [ ] **Step 1: Extend the failing test to require icon provenance and disclaimer coverage**

Add a final test for vendor-branding documentation and required public disclaimers.

```ts
it("documents icon provenance and keeps the non-affiliation disclaimer visible", () => {
  const iconsReadme = readFileSync(resolve(root, "site/assets/icons/README.md"), "utf8");
  expect(iconsReadme).toContain("official vendor sources");
  expect(iconsReadme).toContain("informational contexts");

  const landing = readFileSync(resolve(root, "site/index.html"), "utf8");
  expect(landing).toContain("not affiliated with, endorsed by, or sponsored by");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/enterprise-site.test.ts`

Expected: FAIL because the icon provenance file does not exist yet

- [ ] **Step 3: Add the provenance note and update the project trackers**

Create a small provenance note for logos and update the engineering tracker, logbook, and backlog to include the public site workstream.

```md
<!-- site/assets/icons/README.md -->
<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Icon And Logo Provenance

This site uses vendor logos, wordmarks, or product identifiers only in neutral informational contexts.

- Source logos and wordmarks from official vendor sources.
- Do not alter them in ways that imply endorsement or sponsorship.
- Use neutral technical iconography when a component does not have clear public vendor branding.
```

- [ ] **Step 4: Run the complete verification suite**

Run: `npx vitest run test/enterprise-site.test.ts test/enterprise-azure-anf-incubator.test.ts test/enterprise-program-control.test.ts`

Expected: PASS

Run: `python3 -m http.server 4173 --directory site`

Expected: static server starts successfully and the site is viewable locally at `http://127.0.0.1:4173`

- [ ] **Step 5: Commit**

```bash
git add site/assets/icons/README.md test/enterprise-site.test.ts incubator/enterprise-azure-anf/specs/15-engineering-tracker.md incubator/enterprise-azure-anf/specs/16-program-logbook.md incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md
git commit -m "feat(site): finalize public enterprise publishing surface"
```
