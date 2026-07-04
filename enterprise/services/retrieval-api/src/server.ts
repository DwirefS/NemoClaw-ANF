// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { RetrievalBackend } from "./backend.ts";
import type { RetrievalApiConfig } from "./config.ts";
import type {
  ErrorResponseBody,
  RetrievalRequestBody,
  RetrievalResponseBody,
} from "./contracts.ts";
import type { MemoryKind, MemoryStore } from "./memory.ts";
import { resolveRetrievalPolicy } from "./policy.ts";

export interface RetrievalApiServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): AddressInfo | string | null;
}

interface CreateServerOptions {
  backend: RetrievalBackend;
  config: RetrievalApiConfig;
  /** Present only in pgvector mode; memory routes 404 without it. */
  memoryStore?: MemoryStore;
}

interface MemoryWriteBody {
  agentId: string;
  kind: MemoryKind;
  content: string;
  metadata?: Record<string, unknown>;
}

interface MemoryRecallBody {
  agentId: string;
  query?: string;
  kind?: MemoryKind;
  limit?: number;
}

function isMemoryKind(value: unknown): value is MemoryKind {
  return value === "episodic" || value === "semantic";
}

function parseMemoryWriteBody(rawBody: string): MemoryWriteBody | null {
  try {
    const body = JSON.parse(rawBody) as Partial<MemoryWriteBody>;
    if (
      typeof body.agentId !== "string" ||
      body.agentId.trim() === "" ||
      typeof body.content !== "string" ||
      body.content.trim() === "" ||
      !isMemoryKind(body.kind)
    ) {
      return null;
    }
    return {
      agentId: body.agentId,
      kind: body.kind,
      content: body.content,
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : undefined,
    };
  } catch {
    return null;
  }
}

function parseMemoryRecallBody(rawBody: string): MemoryRecallBody | null {
  try {
    const body = JSON.parse(rawBody) as Partial<MemoryRecallBody>;
    if (typeof body.agentId !== "string" || body.agentId.trim() === "") {
      return null;
    }
    if (body.kind !== undefined && !isMemoryKind(body.kind)) {
      return null;
    }
    if (body.query !== undefined && typeof body.query !== "string") {
      return null;
    }
    if (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1)) {
      return null;
    }
    return { agentId: body.agentId, query: body.query, kind: body.kind, limit: body.limit };
  } catch {
    return null;
  }
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: object): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

function parseRequestBody(rawBody: string): RetrievalRequestBody | null {
  try {
    const body = JSON.parse(rawBody) as Partial<RetrievalRequestBody>;
    if (
      typeof body.query !== "string" ||
      body.query.trim() === "" ||
      (body.role !== "field-agent" && body.role !== "vault-agent")
    ) {
      return null;
    }

    if (body.collections && !Array.isArray(body.collections)) {
      return null;
    }

    if (body.collections?.some((value) => typeof value !== "string")) {
      return null;
    }

    if (
      body.maxResults !== undefined &&
      (!Number.isInteger(body.maxResults) || body.maxResults < 1)
    ) {
      return null;
    }

    if (body.principals && !Array.isArray(body.principals)) {
      return null;
    }

    if (body.principals?.some((value) => typeof value !== "string" || value.trim() === "")) {
      return null;
    }

    return {
      query: body.query,
      role: body.role,
      collections: body.collections,
      maxResults: body.maxResults,
      principals: body.principals,
    };
  } catch {
    return null;
  }
}

const MAX_BODY_BYTES = 64 * 1024;

async function readBody(request: http.IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      return null;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createRetrievalApiServer(options: CreateServerOptions): RetrievalApiServer {
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      // Liveness: the process is up and serving. Kept dependency-free so a
      // database outage surfaces as not-ready rather than a restart loop.
      sendJson(response, 200, { ok: true, service: options.config.serviceName });
      return;
    }

    if (request.method === "GET" && request.url === "/readyz") {
      try {
        const health = await options.backend.health();
        sendJson(response, 200, { ...health, service: options.config.serviceName });
      } catch (error) {
        sendJson(response, 503, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/v1/memory") {
      if (!options.memoryStore) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }
      const rawBody = await readBody(request);
      if (rawBody === null) {
        sendJson(response, 413, { error: "invalid_request", message: "Request body too large." });
        return;
      }
      const body = parseMemoryWriteBody(rawBody);
      if (!body) {
        sendJson(response, 400, {
          error: "invalid_request",
          message: "agentId, kind (episodic|semantic), and content are required.",
        });
        return;
      }
      const { id } = await options.memoryStore.remember(body);
      sendJson(response, 201, { id, agentId: body.agentId, kind: body.kind });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/memory/recall") {
      if (!options.memoryStore) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }
      const rawBody = await readBody(request);
      if (rawBody === null) {
        sendJson(response, 413, { error: "invalid_request", message: "Request body too large." });
        return;
      }
      const body = parseMemoryRecallBody(rawBody);
      if (!body) {
        sendJson(response, 400, {
          error: "invalid_request",
          message: "agentId is required; kind and limit must be valid when present.",
        });
        return;
      }
      const results = await options.memoryStore.recall(body);
      sendJson(response, 200, { agentId: body.agentId, results });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/query") {
      const rawBody = await readBody(request);
      if (rawBody === null) {
        sendJson(response, 413, { error: "invalid_request", message: "Request body too large." });
        return;
      }
      const body = parseRequestBody(rawBody);
      if (!body) {
        const payload: ErrorResponseBody = {
          error: "invalid_request",
          message: "Query, role, and request shape must be valid.",
        };
        sendJson(response, 400, payload);
        return;
      }

      const policy = resolveRetrievalPolicy(body);
      if (policy.filteredCollections.length === 0) {
        const payload: ErrorResponseBody = {
          error: "forbidden",
          message: "No requested collections are permitted for this role.",
        };
        sendJson(response, 403, payload);
        return;
      }

      const results = await options.backend.search({
        query: body.query,
        role: body.role,
        collections: policy.filteredCollections,
        maxResults: policy.maxResults,
        principals: policy.principals,
      });

      const payload: RetrievalResponseBody = {
        queryId: randomUUID(),
        role: body.role,
        groundingMode: policy.groundingMode,
        policy: policy.summary,
        results,
      };
      sendJson(response, 200, payload);
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  });

  return {
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.config.port, options.config.host, () => {
          server.off("error", reject);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    address() {
      return server.address();
    },
  };
}
