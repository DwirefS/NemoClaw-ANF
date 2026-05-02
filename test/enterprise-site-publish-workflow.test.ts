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
