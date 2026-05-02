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
