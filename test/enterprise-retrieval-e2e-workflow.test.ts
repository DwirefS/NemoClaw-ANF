// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

const workflowPath = resolve(repoRoot, ".github/workflows/enterprise-retrieval-e2e.yaml");
const e2eScriptPath = resolve(
  repoRoot,
  "enterprise/services/retrieval-api/scripts/e2e-local-stack.mjs",
);

describe("enterprise retrieval e2e workflow", () => {
  it("runs the retrieval path against a live pgvector service container", () => {
    const yaml = readFileSync(workflowPath, "utf8");

    expect(yaml).toContain("pgvector/pgvector:");
    expect(yaml).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(yaml).toContain("npm run bootstrap");
    expect(yaml).toContain("npm run verify:postgres");
    expect(yaml).toContain("npm run e2e:local");
    expect(yaml).toContain("enterprise/services/console");
  });

  it("ships an e2e script that proves role and ACL enforcement over HTTP", () => {
    const script = readFileSync(e2eScriptPath, "utf8");

    expect(script).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(script).toContain("/v1/embeddings");
    expect(script).toContain("/v1/ranking");
    expect(script).toContain("field-agent");
    expect(script).toContain("vault-agent");
    expect(script).toContain("acl");
    expect(script).toContain("principals");
  });
});
