// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = resolve(
  import.meta.dirname,
  "..",
  "incubator/enterprise-azure-anf/manifests/retrieval-bootstrap-job.yaml",
);

describe("retrieval bootstrap job manifest", () => {
  it("runs the retrieval bootstrap command against PostgreSQL", () => {
    const yaml = readFileSync(manifestPath, "utf8");
    expect(yaml).toContain("kind: Job");
    expect(yaml).toContain("retrieval-bootstrap");
    expect(yaml).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(yaml).toContain("npm run bootstrap");
    expect(yaml).toContain("restartPolicy: OnFailure");
    expect(yaml).toContain("retrieval-api-secrets");
    expect(yaml).toContain("postgres-dsn");
  });

  it("documents the bootstrap dependency for the retrieval service", () => {
    const serviceYaml = readFileSync(
      resolve(import.meta.dirname, "..", "incubator/enterprise-azure-anf/manifests/retrieval-api.yaml"),
      "utf8",
    );

    const readme = readFileSync(
      resolve(import.meta.dirname, "..", "enterprise/services/retrieval-api/README.md"),
      "utf8",
    );

    const packageJson = readFileSync(
      resolve(import.meta.dirname, "..", "enterprise/services/retrieval-api/package.json"),
      "utf8",
    );

    expect(serviceYaml).toContain("retrieval-bootstrap");
    expect(readme).toContain("Run the bootstrap job before the retrieval API deployment points at a fresh PostgreSQL instance.");
    expect(packageJson).toContain('"bootstrap": "node --experimental-strip-types ./src/bootstrap.ts"');
  });
});
