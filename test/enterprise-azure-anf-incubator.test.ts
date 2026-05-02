// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const repoRoot = path.resolve(import.meta.dirname, "..");
const incubatorRoot = path.join(repoRoot, "incubator", "enterprise-azure-anf");

const requiredProfiles = [
  "profiles/field-agent.yaml",
  "profiles/vault-agent.yaml",
  "profiles/shared-policy-contract.yaml",
];

const requiredManifests = [
  "manifests/README.md",
  "manifests/trident-backend-anf.yaml",
  "manifests/storageclasses-anf.yaml",
  "manifests/postgresql-pgvector-statefulset.yaml",
  "manifests/nv-ingest-trigger.yaml",
  "manifests/nim-services.yaml",
  "manifests/guardrails-service.yaml",
  "manifests/retrieval-api.yaml",
  "manifests/nemoclaw-worker-tier.yaml",
  "manifests/private-connectivity.yaml",
];

const requiredSkills = [
  ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-corpus/SKILL.md",
  ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-architecture/SKILL.md",
  ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-deployment/SKILL.md",
  ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-execution-control/SKILL.md",
  ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-productize/SKILL.md",
];

const requiredEnterpriseOverlayFiles = [
  "enterprise/README.md",
  "enterprise/services/retrieval-api/README.md",
  "enterprise/services/retrieval-api/package.json",
  "enterprise/services/retrieval-api/tsconfig.json",
  "enterprise/services/retrieval-api/Dockerfile",
  "enterprise/services/retrieval-api/src/bootstrap.ts",
  "enterprise/services/retrieval-api/src/index.ts",
  "enterprise/services/retrieval-api/src/backend-factory.ts",
  "enterprise/services/retrieval-api/src/nim-http.ts",
  "enterprise/services/retrieval-api/src/migrations.ts",
  "enterprise/services/retrieval-api/src/nvidia.ts",
  "enterprise/services/retrieval-api/src/pgvector-backend.ts",
  "enterprise/services/retrieval-api/src/server.ts",
  "enterprise/services/retrieval-api/src/pgvector.ts",
  "enterprise/services/retrieval-api/sql/001_document_chunks.sql",
  "enterprise/workers/nemo-retriever-ingest/README.md",
  "enterprise/workers/nemo-retriever-ingest/Dockerfile",
  "enterprise/workers/nemo-retriever-ingest/requirements.txt",
  "enterprise/workers/nemo-retriever-ingest/src/config.py",
  "enterprise/workers/nemo-retriever-ingest/src/main.py",
  "enterprise/workers/nemo-retriever-ingest/src/postgres_writer.py",
];

const requiredSpecs = Array.from({ length: 19 }, (_, index) =>
  `specs/${String(index).padStart(2, "0")}${
    [
      "-executive-summary.md",
      "-requirements-and-success-criteria.md",
      "-source-of-truth-and-corpus-model.md",
      "-current-state-architecture-hybrid.md",
      "-future-state-full-aks-appendix.md",
      "-data-plane-rag-and-pgvector.md",
      "-agent-runtime-and-openshell-boundary.md",
      "-security-trust-zones-and-guardrails.md",
      "-anf-storage-layout-and-dr.md",
      "-deployment-workstreams.md",
      "-benchmarking-and-acceptance.md",
      "-risks-gaps-and-promotion-criteria.md",
      "-repo-strategy-and-upstream-sync.md",
      "-upstream-component-map.md",
      "-observations-and-considerations-log.md",
      "-engineering-tracker.md",
      "-program-logbook.md",
      "-delivery-backlog-and-dependencies.md",
      "-change-control-and-execution-rules.md",
    ][index]
  }`,
);

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("missing frontmatter");
  }
  return parseYaml(match[1]);
}

describe("enterprise Azure ANF incubator", () => {
  it("includes the full requested spec set", () => {
    for (const relativePath of requiredSpecs) {
      expect(exists(path.join("incubator", "enterprise-azure-anf", relativePath))).toBe(true);
    }
  });

  it("tracks the supplied research corpus and contradiction graph", () => {
    const manifest = parseYaml(read("incubator/enterprise-azure-anf/corpus/manifest.yaml"));
    const graph = JSON.parse(read("incubator/enterprise-azure-anf/corpus/graph.json"));

    expect(manifest.records.length).toBeGreaterThanOrEqual(25);
    expect(graph.nodes.some((node: { id: string }) => node.id === "claim-pgvector-target")).toBe(
      true,
    );
    expect(
      graph.edges.some(
        (edge: { from: string; to: string; type: string }) =>
          edge.from === "claim-pgvector-target" &&
          edge.to === "claim-stock-vdb-path" &&
          edge.type === "contradicts",
      ),
    ).toBe(true);
  });

  it("includes required role profiles and example deployment manifests", () => {
    for (const relativePath of [...requiredProfiles, ...requiredManifests]) {
      expect(exists(path.join("incubator", "enterprise-azure-anf", relativePath))).toBe(true);
    }
  });

  it("keeps YAML incubator assets parseable", () => {
    const yamlFiles = [
      "incubator/enterprise-azure-anf/corpus/manifest.yaml",
      ...requiredProfiles.map((relativePath) => path.join("incubator", "enterprise-azure-anf", relativePath)),
      ...requiredManifests
        .filter((relativePath) => relativePath.endsWith(".yaml"))
        .map((relativePath) => path.join("incubator", "enterprise-azure-anf", relativePath)),
    ];

    for (const relativePath of yamlFiles) {
      expect(() => parseYaml(read(relativePath))).not.toThrow();
    }
  });

  it("ships incubator contributor skills with valid frontmatter", () => {
    for (const relativePath of requiredSkills) {
      expect(exists(relativePath)).toBe(true);
      const frontmatter = parseFrontmatter(read(relativePath));
      expect(typeof frontmatter.name).toBe("string");
      expect(frontmatter.name.length).toBeGreaterThan(0);
      expect(typeof frontmatter.description).toBe("string");
      expect(frontmatter.description.startsWith("Use when")).toBe(true);
    }
  });

  it("uses Mermaid sources as the diagram truth", () => {
    const diagramRoot = path.join(incubatorRoot, "diagrams");
    const sourceFiles = fs.readdirSync(diagramRoot).filter((file) => file.endsWith(".mmd"));

    expect(sourceFiles.sort()).toEqual([
      "anf_roles.mmd",
      "arch_overview.mmd",
      "ingestion_flow.mmd",
      "multiagent_security.mmd",
      "rag_flow.mmd",
    ]);

    for (const file of sourceFiles) {
      const contents = fs.readFileSync(path.join(diagramRoot, file), "utf8").trimStart();
      expect(
        contents.startsWith("graph ") || contents.startsWith("graph\n") ||
          contents.startsWith("sequenceDiagram"),
      ).toBe(true);
    }
  });

  it("includes the first enterprise runtime slice outside NemoClaw core", () => {
    for (const relativePath of requiredEnterpriseOverlayFiles) {
      expect(exists(relativePath)).toBe(true);
    }

    const packageJson = JSON.parse(read("enterprise/services/retrieval-api/package.json"));
    expect(packageJson.name).toBe("@nemoclaw-enterprise/retrieval-api");
    expect(packageJson.private).toBe(true);
  });
});
