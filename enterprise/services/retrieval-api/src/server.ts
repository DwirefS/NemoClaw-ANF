// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import http from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { RetrievalApiConfig } from "./config";
import type { ErrorResponseBody, RetrievalRequestBody, RetrievalResponseBody } from "./contracts";
import type { RetrievalBackend } from "./backend";
import { resolveRetrievalPolicy } from "./policy";

export interface RetrievalApiServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): AddressInfo | string | null;
}

interface CreateServerOptions {
  backend: RetrievalBackend;
  config: RetrievalApiConfig;
}

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
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

    if (body.maxResults !== undefined && (!Number.isInteger(body.maxResults) || body.maxResults < 1)) {
      return null;
    }

    return {
      query: body.query,
      role: body.role,
      collections: body.collections,
      maxResults: body.maxResults,
    };
  } catch {
    return null;
  }
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createRetrievalApiServer(options: CreateServerOptions): RetrievalApiServer {
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      const health = await options.backend.health();
      sendJson(response, 200, { ...health, service: options.config.serviceName });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/query") {
      const body = parseRequestBody(await readBody(request));
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
