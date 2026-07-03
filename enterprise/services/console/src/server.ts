// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConsoleConfig } from "./config.ts";
import { buildGroundedChatRequest, extractAnswer, type RetrievalResult } from "./grounding.ts";

export interface ConsoleServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): AddressInfo | string | null;
}

export interface CreateConsoleServerOptions {
  config: ConsoleConfig;
  fetchImpl?: typeof fetch;
}

interface ConsoleChatRequestBody {
  query: string;
  role: "field-agent" | "vault-agent";
  collections?: string[];
  principals?: string[];
  maxResults?: number;
}

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseChatBody(rawBody: string): ConsoleChatRequestBody | null {
  try {
    const body = JSON.parse(rawBody) as Partial<ConsoleChatRequestBody>;
    if (
      typeof body.query !== "string" ||
      body.query.trim() === "" ||
      (body.role !== "field-agent" && body.role !== "vault-agent")
    ) {
      return null;
    }
    return {
      query: body.query,
      role: body.role,
      collections: Array.isArray(body.collections) ? body.collections : undefined,
      principals: Array.isArray(body.principals) ? body.principals : undefined,
      maxResults: typeof body.maxResults === "number" ? body.maxResults : undefined,
    };
  } catch {
    return null;
  }
}

function serveStatic(requestUrl: string, response: http.ServerResponse): void {
  const urlPath = requestUrl === "/" ? "/index.html" : requestUrl;
  const filePath = path.join(publicRoot, path.normalize(urlPath));
  if (
    !filePath.startsWith(publicRoot) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }
  response.statusCode = 200;
  response.setHeader(
    "content-type",
    CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
  );
  response.end(fs.readFileSync(filePath));
}

export function createConsoleServer(options: CreateConsoleServerOptions): ConsoleServer {
  const fetchImpl = options.fetchImpl ?? fetch;
  const { config } = options;

  async function queryRetrieval(body: ConsoleChatRequestBody): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (config.retrievalToken !== "") {
      headers.authorization = `Bearer ${config.retrievalToken}`;
    }
    return fetchImpl(`${config.retrievalApiUrl.replace(/\/$/, "")}/v1/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: body.query,
        role: body.role,
        collections: body.collections,
        principals: body.principals,
        maxResults: body.maxResults,
      }),
    });
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/healthz") {
        sendJson(response, 200, { ok: true, service: config.serviceName });
        return;
      }

      if (request.method === "GET" && request.url === "/api/config") {
        sendJson(response, 200, {
          chatModel: config.chatModel,
          retrievalApiUrl: config.retrievalApiUrl,
        });
        return;
      }

      if (request.method === "POST" && request.url === "/api/query") {
        const body = parseChatBody(await readBody(request));
        if (!body) {
          sendJson(response, 400, { error: "invalid_request" });
          return;
        }
        const retrieval = await queryRetrieval(body);
        const payload = (await retrieval.json()) as Record<string, unknown>;
        sendJson(response, retrieval.status, payload);
        return;
      }

      if (request.method === "POST" && request.url === "/api/chat") {
        const body = parseChatBody(await readBody(request));
        if (!body) {
          sendJson(response, 400, { error: "invalid_request" });
          return;
        }

        const retrieval = await queryRetrieval(body);
        const retrievalPayload = (await retrieval.json()) as {
          results?: RetrievalResult[];
          policy?: Record<string, unknown>;
          groundingMode?: string;
          error?: string;
          message?: string;
        };
        if (!retrieval.ok) {
          sendJson(response, retrieval.status, retrievalPayload as Record<string, unknown>);
          return;
        }

        const results = retrievalPayload.results ?? [];
        const chatRequest = buildGroundedChatRequest(config.chatModel, body.query, results);
        const chat = await fetchImpl(
          `${config.chatEndpoint.replace(/\/$/, "")}/v1/chat/completions`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(chatRequest),
          },
        );
        if (!chat.ok) {
          sendJson(response, 502, {
            error: "chat_upstream_failed",
            message: `Chat endpoint returned ${chat.status}`,
          });
          return;
        }

        sendJson(response, 200, {
          answer: extractAnswer(await chat.json()),
          model: config.chatModel,
          groundingMode: retrievalPayload.groundingMode,
          policy: retrievalPayload.policy,
          results,
        });
        return;
      }

      if (request.method === "GET" && request.url) {
        serveStatic(request.url, response);
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
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
