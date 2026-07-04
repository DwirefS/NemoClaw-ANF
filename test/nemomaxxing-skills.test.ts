// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const repoRoot = path.resolve(import.meta.dirname, "..");

const requiredSkillDirs = [
  "nemomaxxing-overview",
  "nemomaxxing-deploy-azure-infra",
  "nemomaxxing-deploy-platform",
  "nemomaxxing-validate-and-operate",
];

const requiredBodyPaths = ["enterprise/deploy/", "enterprise/services/retrieval-api"];

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

function skillPath(skillDir: string) {
  return path.join(".agents", "skills", skillDir, "SKILL.md");
}

function skillBody(markdown: string) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
}

describe("NemoMaxxing platform skills", () => {
  it("ships all four NemoMaxxing skills", () => {
    for (const skillDir of requiredSkillDirs) {
      expect(exists(skillPath(skillDir))).toBe(true);
    }
  });

  it("ships valid frontmatter with names matching their directories", () => {
    for (const skillDir of requiredSkillDirs) {
      const frontmatter = parseFrontmatter(read(skillPath(skillDir)));
      expect(typeof frontmatter.name).toBe("string");
      expect(frontmatter.name.length).toBeGreaterThan(0);
      expect(frontmatter.name).toBe(skillDir);
      expect(typeof frontmatter.description).toBe("string");
      expect(frontmatter.description.startsWith("Use when")).toBe(true);
    }
  });

  it("references the key deployment and retrieval paths in each skill body", () => {
    for (const skillDir of requiredSkillDirs) {
      const body = skillBody(read(skillPath(skillDir)));
      for (const requiredPath of requiredBodyPaths) {
        expect(body).toContain(requiredPath);
      }
    }
  });

  it("covers the full model and storage stack in the overview skill", () => {
    const body = skillBody(read(skillPath("nemomaxxing-overview")));
    for (const requiredTerm of ["Nemotron", "Gemma", "Azure NetApp Files"]) {
      expect(body).toContain(requiredTerm);
    }
  });
});
