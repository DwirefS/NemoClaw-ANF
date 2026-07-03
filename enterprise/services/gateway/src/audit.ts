// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import fs from "node:fs";

export interface AuditEvent {
  ts: string;
  requestId: string;
  subject: string;
  role: string;
  principals: string[];
  /** SHA-256 of the query text: correlate without storing raw queries. */
  queryHash: string;
  decision: "allow" | "deny";
  reason?: string;
  status: number;
  resultCount?: number;
  chunkIds?: string[];
  redactions?: number;
  latencyMs: number;
}

export interface AuditWriter {
  write(event: AuditEvent): void;
}

export function hashQuery(query: string): string {
  return createHash("sha256").update(query, "utf8").digest("hex").slice(0, 32);
}

export function createAuditWriter(auditLogPath: string): AuditWriter {
  if (auditLogPath === "") {
    return {
      write(event) {
        process.stdout.write(`${JSON.stringify({ audit: event })}\n`);
      },
    };
  }
  const stream = fs.createWriteStream(auditLogPath, { flags: "a" });
  return {
    write(event) {
      stream.write(`${JSON.stringify(event)}\n`);
    },
  };
}
