// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { type AuditWriter, hashQuery } from "./audit.ts";
import type { GatewayConfig } from "./config.ts";
import type { AgentRole, IdentityResolver } from "./identity.ts";
import type { GatewayMetrics } from "./metrics.ts";
import type { RateLimiter } from "./ratelimit.ts";
import { redactText } from "./redaction.ts";

const MAX_BODY_BYTES = 64 * 1024;

export interface GatewayServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): AddressInfo | string | null;
}

export interface CreateGatewayServerOptions {
  config: GatewayConfig;
  identityResolver: IdentityResolver;
  auditWriter: AuditWriter;
  metrics: GatewayMetrics;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
}

interface GatewayQueryBody {
  query: string;
  role: AgentRole;
  collections?: string[];
  maxResults?: number;
}

interface RetrievalResponsePayload {
  queryId?: string;
  groundingMode?: string;
  policy?: Record<string, unknown>;
  results?: Array<{ id: string; content: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: object): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

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

function parseQueryBody(rawBody: string): GatewayQueryBody | null {
  try {
    const body = JSON.parse(rawBody) as Partial<GatewayQueryBody> & { principals?: unknown };
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
    return {
      query: body.query,
      role: body.role,
      collections: body.collections,
      maxResults: typeof body.maxResults === "number" ? body.maxResults : undefined,
    };
  } catch {
    return null;
  }
}

export function createGatewayServer(options: CreateGatewayServerOptions): GatewayServer {
  const { config, identityResolver, auditWriter, metrics, rateLimiter } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function handleQuery(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const startedAt = Date.now();
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);

    const authorization = request.headers.authorization ?? "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    function deny(status: number, reason: string, subject = "anonymous", role = "unknown"): void {
      metrics.recordDenied(reason);
      metrics.recordRequest(role, status, Date.now() - startedAt);
      auditWriter.write({
        ts: new Date().toISOString(),
        requestId,
        subject,
        role,
        principals: [],
        queryHash: "",
        decision: "deny",
        reason,
        status,
        latencyMs: Date.now() - startedAt,
      });
      sendJson(response, status, { error: reason, requestId });
    }

    if (bearer === "") {
      deny(401, "missing_bearer_token");
      return;
    }

    let identity: Awaited<ReturnType<IdentityResolver["resolve"]>>;
    try {
      identity = await identityResolver.resolve(bearer);
    } catch (error) {
      deny(
        503,
        `identity_resolution_failed:${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    if (!identity) {
      deny(401, "invalid_token");
      return;
    }

    if (!rateLimiter.allow(identity.subject)) {
      deny(429, "rate_limited", identity.subject);
      return;
    }

    const rawBody = await readBody(request);
    if (rawBody === null) {
      deny(413, "body_too_large", identity.subject);
      return;
    }
    const body = parseQueryBody(rawBody);
    if (!body) {
      deny(400, "invalid_request", identity.subject);
      return;
    }

    if (!identity.allowedRoles.includes(body.role)) {
      deny(403, "role_not_permitted", identity.subject, body.role);
      return;
    }

    // Principals always come from the authenticated identity, never the
    // caller's body. This is the seam that turns the retrieval API's ACL
    // enforcement into authenticated enforcement.
    const upstream = await fetchImpl(`${config.retrievalApiUrl.replace(/\/$/, "")}/v1/query`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({
        query: body.query,
        role: body.role,
        collections: body.collections,
        maxResults: body.maxResults,
        principals: identity.principals,
      }),
    });

    const payload = (await upstream.json()) as RetrievalResponsePayload;
    let redactions = 0;
    if (config.redactionEnabled && upstream.ok && payload.groundingMode === "sanitized-only") {
      for (const result of payload.results ?? []) {
        const redacted = redactText(result.content);
        result.content = redacted.text;
        redactions += redacted.redactions;
      }
      metrics.recordRedactions(redactions);
    }

    const latencyMs = Date.now() - startedAt;
    metrics.recordRequest(body.role, upstream.status, latencyMs);
    auditWriter.write({
      ts: new Date().toISOString(),
      requestId,
      subject: identity.subject,
      role: body.role,
      principals: identity.principals,
      queryHash: hashQuery(body.query),
      decision: upstream.ok ? "allow" : "deny",
      reason: upstream.ok ? undefined : `upstream_${upstream.status}`,
      status: upstream.status,
      resultCount: payload.results?.length,
      chunkIds: payload.results?.map((result) => result.id),
      redactions,
      latencyMs,
    });

    sendJson(response, upstream.status, { ...payload, requestId });
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/healthz") {
        sendJson(response, 200, { ok: true, service: config.serviceName });
        return;
      }

      if (request.method === "GET" && request.url === "/readyz") {
        try {
          const upstream = await fetchImpl(`${config.retrievalApiUrl.replace(/\/$/, "")}/healthz`);
          sendJson(response, upstream.ok ? 200 : 503, {
            ok: upstream.ok,
            upstreamStatus: upstream.status,
          });
        } catch {
          sendJson(response, 503, { ok: false, upstreamStatus: 0 });
        }
        return;
      }

      // RFC 9728 protected-resource metadata: the MCP 2026 authorization
      // model treats gateways like this one as OAuth 2.1 resource servers,
      // and clients discover the authorization server through this document.
      if (request.method === "GET" && request.url === "/.well-known/oauth-protected-resource") {
        sendJson(response, 200, {
          resource: config.publicUrl,
          authorization_servers: config.jwtIssuer ? [config.jwtIssuer] : [],
          bearer_methods_supported: ["header"],
          resource_name: config.serviceName,
        });
        return;
      }

      // A2A-style agent card: advertises the vault/field retrieval capability
      // so agent-to-agent clients can discover this boundary and its auth
      // scheme instead of being hand-wired.
      if (request.method === "GET" && request.url === "/.well-known/agent-card.json") {
        sendJson(response, 200, {
          name: config.serviceName,
          description:
            "NemoMaxxing enterprise retrieval boundary: role-aware, ACL-enforced, audited access to enterprise knowledge on Azure NetApp Files.",
          url: config.publicUrl,
          version: "0.1.0",
          provider: { organization: "NemoMaxxing" },
          capabilities: {},
          securitySchemes: {
            bearer: {
              type: "http",
              scheme: "bearer",
              description:
                config.authMode === "jwt"
                  ? "RS256 JWT from the configured issuer; roles and groups claims map to agent roles and principals."
                  : "Static bearer token provisioned by the platform operator.",
            },
          },
          skills: [
            {
              id: "retrieval_search",
              name: "Enterprise retrieval search",
              description:
                "Hybrid vector and full-text search over the enterprise corpus with role policy and document ACL enforcement.",
              tags: ["retrieval", "rag", "enterprise"],
            },
          ],
        });
        return;
      }

      if (request.method === "GET" && request.url === "/metrics") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/plain; version=0.0.4");
        response.end(metrics.render());
        return;
      }

      if (request.method === "POST" && request.url === "/v1/query") {
        await handleQuery(request, response);
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
