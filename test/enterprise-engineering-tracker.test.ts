// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("enterprise engineering tracker", () => {
  it("tracks implementation items with explicit status categories", () => {
    const trackerPath = path.join(
      repoRoot,
      "incubator/enterprise-azure-anf/specs/15-engineering-tracker.md",
    );
    const tracker = fs.readFileSync(trackerPath, "utf8");

    expect(tracker).toContain("Status vocabulary");
    expect(tracker).toContain("`validated`");
    expect(tracker).toContain("`assumed`");
    expect(tracker).toContain("`custom-build-required`");
    expect(tracker).toContain("`blocked`");
    expect(tracker).toContain("| Hybrid baseline topology | `validated` |");
    expect(tracker).toContain("| Retrieval API boundary | `validated` |");
    expect(tracker).toContain("| PostgreSQL plus pgvector retrieval store | `custom-build-required` |");
    expect(tracker).toContain("| ACL-aware retrieval filtering | `blocked` |");
  });
});
