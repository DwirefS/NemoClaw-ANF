// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("enterprise program control surfaces", () => {
  it("includes a running program logbook of completed work and conflict resolutions", () => {
    const logbook = read("incubator/enterprise-azure-anf/specs/16-program-logbook.md");

    expect(logbook).toContain("# Program Logbook");
    expect(logbook).toContain("retrieval API");
    expect(logbook).toContain("NeMo Retriever ingestion worker");
    expect(logbook).toContain("Conflict and resolution record");
  });

  it("includes a delivery backlog with remaining work and dependency tracking", () => {
    const backlog = read("incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md");

    expect(backlog).toContain("# Delivery Backlog And Dependencies");
    expect(backlog).toContain("| ACL-aware retrieval filtering |");
    expect(backlog).toContain("| retrieval schema bootstrap job |");
    expect(backlog).toContain("| live NeMo Retriever validation |");
    expect(backlog).toContain("Dependency notes");
  });

  it("includes change-control rules that require approval before removals or deletions", () => {
    const rules = read("incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md");

    expect(rules).toContain("Do not remove, delete, or destructively replace");
    expect(rules).toContain("obtain explicit user approval first");
    expect(rules).toContain("Write or update a plan before substantial execution");
    expect(rules).toContain("After each implementation pass");
  });

  it("ships a contributor execution-control skill that points future agents at the control surfaces", () => {
    const skill = read(
      ".agents/skills/nemoclaw-contributor-enterprise-azure-anf-execution-control/SKILL.md",
    );

    expect(skill).toContain("15-engineering-tracker.md");
    expect(skill).toContain("16-program-logbook.md");
    expect(skill).toContain("17-delivery-backlog-and-dependencies.md");
    expect(skill).toContain("18-change-control-and-execution-rules.md");
    expect(skill).toContain("Do not remove, delete, or destructively replace");
    expect(skill).toContain("obtain explicit user approval first");
  });
});
