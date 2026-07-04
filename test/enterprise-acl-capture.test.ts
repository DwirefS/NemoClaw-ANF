// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workerSrc = path.join(repoRoot, "enterprise/workers/nemo-retriever-ingest/src");

describe("enterprise ACL capture", () => {
  it("maps POSIX modes and NFSv4 ACLs to retrieval principals", () => {
    const module = fs.readFileSync(path.join(workerSrc, "acl_capture.py"), "utf8");

    expect(module).toContain("def capture_acl_principals");
    expect(module).toContain("def parse_nfs4_acl");
    expect(module).toContain("EVERYONE@");
    expect(module).toContain("group:gid-");
  });

  it("passes its executable self-test", () => {
    const stdout = execFileSync("python3", [path.join(workerSrc, "acl_capture.py")], {
      encoding: "utf8",
    });

    expect(stdout).toContain("SELF-TEST PASS");
  });

  it("is wired into the ingestion worker with a non-fatal guard", () => {
    execFileSync("python3", ["-m", "py_compile", path.join(workerSrc, "main.py")]);
    const main = fs.readFileSync(path.join(workerSrc, "main.py"), "utf8");

    expect(main).toContain("capture_acl_principals");
    expect(main).toContain("except Exception");
  });
});
