// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("enterprise NeMo Retriever ingestion worker", () => {
  it("ships a project-owned ingestion worker package", () => {
    const files = [
      "enterprise/workers/nemo-retriever-ingest/README.md",
      "enterprise/workers/nemo-retriever-ingest/Dockerfile",
      "enterprise/workers/nemo-retriever-ingest/requirements.txt",
      "enterprise/workers/nemo-retriever-ingest/src/config.py",
      "enterprise/workers/nemo-retriever-ingest/src/main.py",
      "enterprise/workers/nemo-retriever-ingest/src/postgres_writer.py",
    ];

    for (const file of files) {
      expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
    }
  });

  it("uses the documented NeMo Retriever pipeline and writes to PostgreSQL", () => {
    const main = read("enterprise/workers/nemo-retriever-ingest/src/main.py");

    expect(main).toContain("from nemo_retriever import create_ingestor");
    expect(main).toContain(".files(config.documents)");
    expect(main).toContain(".extract(");
    expect(main).toContain(".embed()");
    expect(main).toContain("write_chunks_to_postgres");
  });

  it("points the incubator manifest at the packaged worker image and config env vars", () => {
    const manifest = read("incubator/enterprise-azure-anf/manifests/nv-ingest-trigger.yaml");

    expect(manifest).toContain("ghcr.io/dwirefs/nemoclaw-anf/nemo-retriever-ingest:dev");
    expect(manifest).toContain("INGEST_SOURCE_DIR");
    expect(manifest).toContain("POSTGRES_DSN");
    expect(manifest).toContain("EMBEDDING_ENDPOINT");
    expect(manifest).toContain("PARSE_ENDPOINT");
    expect(manifest).not.toContain("pip install --no-cache-dir");
    expect(manifest).not.toContain("cat <<'PY' >/work/run_ingest.py");
  });
});
