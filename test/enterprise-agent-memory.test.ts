// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createMemoryStore, memoryId } from "../enterprise/services/retrieval-api/src/memory";
import { createRetrievalApiServer } from "../enterprise/services/retrieval-api/src/server";
import { createStaticBackend } from "../enterprise/services/retrieval-api/src/backend";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("enterprise agent memory", () => {
  it("defines the agent_memory schema with tiered indexes", () => {
    const sql = fs.readFileSync(
      path.join(repoRoot, "enterprise/services/retrieval-api/sql/003_agent_memory.sql"),
      "utf8",
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS agent_memory");
    expect(sql).toContain("kind IN ('episodic', 'semantic')");
    expect(sql).toContain("agent_memory_agent_recency_idx");
    expect(sql).toContain("WHERE embedding IS NOT NULL");
  });

  it("derives stable content-addressed memory ids", () => {
    const id = memoryId("user:alice", "the BOM deadline is Friday");

    expect(id).toMatch(/^mem-[0-9a-f]{32}$/);
    expect(memoryId("user:alice", "the BOM deadline is Friday")).toBe(id);
    expect(memoryId("user:bob", "the BOM deadline is Friday")).not.toBe(id);
  });

  it("embeds semantic memories and stores episodic memories without embedding", async () => {
    const query = vi.fn(async (_sql: string, _parameters: unknown[]) => ({ rows: [] }));
    const embedQuery = vi.fn(async (_query: string) => [0.1, 0.2, 0.3]);
    const store = createMemoryStore({ client: { query }, embeddingProvider: { embedQuery } });

    await store.remember({ agentId: "user:alice", kind: "semantic", content: "prefers NFSv4.1" });
    expect(embedQuery).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]?.[4]).toBe("[0.1,0.2,0.3]");

    await store.remember({ agentId: "user:alice", kind: "episodic", content: "asked about BOM" });
    expect(embedQuery).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[1]?.[1]?.[4]).toBeNull();
  });

  it("scopes every recall path to the agent id", async () => {
    const query = vi.fn(async (_sql: string, _parameters: unknown[]) => ({ rows: [] }));
    const store = createMemoryStore({
      client: { query },
      embeddingProvider: { embedQuery: async (_query: string) => [0.5] },
    });

    await store.recall({ agentId: "user:alice" });
    await store.recall({ agentId: "user:alice", query: "BOM deadline" });

    for (const call of query.mock.calls) {
      expect(String(call[0])).toContain("agent_id = $1");
      expect(call[1]?.[0]).toBe("user:alice");
    }
  });

  it("returns 404 for memory routes when no store is configured", async () => {
    const server = createRetrievalApiServer({
      backend: createStaticBackend([]),
      config: { host: "127.0.0.1", port: 0, profileMode: "hybrid", serviceName: "t" },
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/memory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "a", kind: "episodic", content: "x" }),
      });
      expect(response.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("validates and serves memory writes and recall through the API", async () => {
    const remembered: unknown[] = [];
    const server = createRetrievalApiServer({
      backend: createStaticBackend([]),
      config: { host: "127.0.0.1", port: 0, profileMode: "hybrid", serviceName: "t" },
      memoryStore: {
        remember: async (input) => {
          remembered.push(input);
          return { id: "mem-test" };
        },
        recall: async (input) => [
          {
            id: "mem-test",
            agentId: input.agentId,
            kind: "episodic",
            content: "asked about BOM",
            metadata: {},
            createdAt: "2026-07-04T00:00:00Z",
          },
        ],
      },
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;

    try {
      const bad = await fetch(`${base}/v1/memory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "user:alice", kind: "prophetic", content: "x" }),
      });
      expect(bad.status).toBe(400);

      const write = await fetch(`${base}/v1/memory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "user:alice", kind: "episodic", content: "asked about BOM" }),
      });
      expect(write.status).toBe(201);
      expect(remembered).toHaveLength(1);

      const recall = await fetch(`${base}/v1/memory/recall`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "user:alice" }),
      });
      const payload = (await recall.json()) as { results: Array<{ content: string }> };
      expect(recall.status).toBe(200);
      expect(payload.results[0]?.content).toBe("asked about BOM");
    } finally {
      await server.close();
    }
  });

  it("gateway memory passthrough forces the identity subject as agentId", async () => {
    const { createGatewayServer } = await import("../enterprise/services/gateway/src/server");
    const { createAuditWriter } = await import("../enterprise/services/gateway/src/audit");
    const { loadGatewayConfig } = await import("../enterprise/services/gateway/src/config");
    const { createMetrics } = await import("../enterprise/services/gateway/src/metrics");
    const { createRateLimiter } = await import("../enterprise/services/gateway/src/ratelimit");

    const upstreamBodies: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      upstreamBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response(JSON.stringify({ id: "mem-test" }), { status: 201 });
    }) as unknown as typeof fetch;

    const server = createGatewayServer({
      config: loadGatewayConfig({
        GATEWAY_PORT: "0",
        GATEWAY_HOST: "127.0.0.1",
        GATEWAY_STATIC_TOKENS: JSON.stringify({
          "tok-1": { subject: "user:alice", allowedRoles: ["vault-agent"], principals: [] },
        }),
      }),
      identityResolver: {
        resolve: async (token) =>
          token === "tok-1"
            ? { subject: "user:alice", allowedRoles: ["vault-agent"], principals: [] }
            : null,
      },
      auditWriter: createAuditWriter(""),
      metrics: createMetrics(),
      rateLimiter: createRateLimiter(0),
      fetchImpl,
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/memory`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer tok-1",
        },
        body: JSON.stringify({ agentId: "someone-else", kind: "episodic", content: "note" }),
      });

      expect(response.status).toBe(201);
      expect(upstreamBodies[0]?.agentId).toBe("user:alice");
    } finally {
      await server.close();
    }
  });
});
