// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const artifactsRoot = resolve(root, "artifacts/enterprise-azure-anf");
const landingPage = resolve(root, "site/index.html");
const deepDivePages = [
  "site/architecture/index.html",
  "site/data-plane/index.html",
  "site/security/index.html",
  "site/storage/index.html",
  "site/use-cases/index.html",
  "site/delivery-status/index.html",
  "site/artifacts/index.html",
];
const deliveryStatusPage = resolve(root, "site/delivery-status/index.html");

describe("enterprise public site scaffold", () => {
  it("uses a project-owned site root instead of the upstream docs tree", () => {
    expect(existsSync(resolve(root, "site/index.html"))).toBe(true);
    expect(existsSync(resolve(root, "site/assets/styles/main.css"))).toBe(true);
    expect(existsSync(resolve(root, "site/assets/scripts/main.js"))).toBe(true);
    for (const page of deepDivePages) {
      expect(existsSync(resolve(root, page))).toBe(true);
    }
  });

  it("includes a non-affiliation disclaimer on the landing page", () => {
    const html = readFileSync(landingPage, "utf8");
    const normalized = html.toLowerCase();
    expect(normalized).toContain("independent technical architecture effort");
    expect(normalized).toContain("not affiliated with, endorsed by, or sponsored by");
  });

  it("explains the core stack and links to the public artifacts", () => {
    const html = readFileSync(landingPage, "utf8");
    const normalized = html.toLowerCase();

    const requiredTerms = [
      "Azure NetApp Files",
      "NVIDIA NIM",
      "Nemotron",
      "PostgreSQL",
      "pgvector",
      "Field Agent",
      "Vault Agent",
    ];

    for (const term of requiredTerms) {
      expect(html).toContain(term);
    }

    expect(normalized).toContain("technology stack");
    expect(normalized).toContain("field agent / vault agent");
    expect(normalized).toContain("anf value");
    expect(normalized).toContain("artifact highlight");
    expect(html).toContain("artifacts/enterprise-azure-anf/sovereign-agentic-factory.pdf");
    expect(html).toContain("artifacts/enterprise-azure-anf/enterprise-architecture-overview-board.png");
    expect(html).toContain("artifacts/enterprise-azure-anf/field-vault-secure-gateway-board.png");
    expect(html).toContain("artifacts/enterprise-azure-anf/platform-stack-cloud-diagram.png");
    expect(html).toContain("artifacts/enterprise-azure-anf/enterprise-architecture-poster.png");
  });

  it("publishes visible architecture artifacts outside the incubator", () => {
    expect(existsSync(artifactsRoot)).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "README.md"))).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "enterprise-architecture-overview-board.png"))).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "field-vault-secure-gateway-board.png"))).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "platform-stack-cloud-diagram.png"))).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "enterprise-architecture-poster.png"))).toBe(true);
    expect(existsSync(resolve(artifactsRoot, "sovereign-agentic-factory.pdf"))).toBe(true);
  });

  it("documents icon provenance and keeps the non-affiliation disclaimer visible", () => {
    const iconsReadme = resolve(root, "site/assets/icons/README.md");
    expect(existsSync(iconsReadme)).toBe(true);

    const iconsContents = readFileSync(iconsReadme, "utf8").toLowerCase();
    expect(iconsContents).toContain("official vendor sources");
    expect(iconsContents).toContain("informational contexts");

    const landing = readFileSync(landingPage, "utf8").toLowerCase();
    expect(landing).toContain("not affiliated with, endorsed by, or sponsored by");
  });

  it("describes the delivery status using the required implementation terms", () => {
    const html = readFileSync(deliveryStatusPage, "utf8");

    expect(html).toContain("validated current implementation");
    expect(html).toContain("custom engineering still required");
    expect(html).toContain("ACL-aware retrieval");
  });
});
