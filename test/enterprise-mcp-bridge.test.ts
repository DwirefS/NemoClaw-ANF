// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import {
  loadMcpBridgeConfig,
  type McpBridgeConfig,
} from "../enterprise/services/mcp-bridge/src/config";
import {
  createMcpDispatcher,
  type JsonRpcResponse,
} from "../enterprise/services/mcp-bridge/src/protocol";
import { createBridgeTools } from "../enterprise/services/mcp-bridge/src/tools";

const sampleRetrievalResponse = {
  queryId: "query-1",
  role: "field-agent",
  groundingMode: "sanitized-only",
  policy: {
    directDatabaseAccess: false,
    directDocumentShareAccess: false,
    filteredCollections: ["enterprise-public"],
    deniedCollections: ["enterprise-sensitive"],
  },
  results: [
    {
      id: "chunk-1",
      content: "ANF provides low latency NFS volumes.",
      sourceId: "anf.md",
      title: "ANF overview",
      collection: "enterprise-public",
      classification: "public",
      score: 0.9123,
      metadata: {},
    },
  ],
};

function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init?: RequestInit }>;
} {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function createDispatcher(
  fetchImpl: typeof fetch,
  configOverrides: Partial<McpBridgeConfig> = {},
) {
  const config: McpBridgeConfig = {
    ...loadMcpBridgeConfig({ MCP_UPSTREAM_URL: "http://upstream.test" }),
    ...configOverrides,
  };
  return createMcpDispatcher({
    serverInfo: { name: config.serviceName, version: config.serviceVersion },
    tools: createBridgeTools({ config, fetchImpl }),
  });
}

function resultOf(response: JsonRpcResponse | null): Record<string, unknown> {
  expect(response).not.toBeNull();
  expect(response?.error).toBeUndefined();
  return response?.result as Record<string, unknown>;
}

describe("nemomaxxing mcp bridge", () => {
  it("loads config defaults aligned with the data-plane gateway", () => {
    const config = loadMcpBridgeConfig({});

    expect(config.upstreamUrl).toContain("retrieval-gateway.data-plane.svc.cluster.local");
    expect(config.upstreamToken).toBeUndefined();
    expect(config.defaultRole).toBe("field-agent");
    expect(config.serviceName).toBe("nemomaxxing-mcp-bridge");
    expect(loadMcpBridgeConfig({ MCP_DEFAULT_ROLE: "vault-agent" }).defaultRole).toBe(
      "vault-agent",
    );
  });

  it("answers initialize with protocol version echo and server info", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const echoed = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    const fallback = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {},
    });

    const echoedResult = resultOf(echoed);
    expect(echoedResult.protocolVersion).toBe("2024-11-05");
    expect(echoedResult.serverInfo).toEqual({
      name: "nemomaxxing-mcp-bridge",
      version: "0.1.0",
    });
    expect(echoedResult.capabilities).toEqual({ tools: {} });
    expect(resultOf(fallback).protocolVersion).toBe("2025-06-18");
  });

  it("treats notifications/initialized as a notification with no response", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    expect(response).toBeNull();
  });

  it("lists retrieval_search and retrieval_health with JSON Schema inputs", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const response = await dispatcher.dispatch({ jsonrpc: "2.0", id: 3, method: "tools/list" });

    const tools = resultOf(response).tools as Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("retrieval_search");
    expect(names).toContain("retrieval_health");
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.description).toBe("string");
    }
    const search = tools.find((tool) => tool.name === "retrieval_search");
    expect(search?.inputSchema.required).toEqual(["query"]);
    const properties = search?.inputSchema.properties as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual(["query", "role", "collections", "maxResults"]);
  });

  it("formats retrieval_search results with a denied collections line", async () => {
    const { fetchImpl } = stubFetch(
      () => new Response(JSON.stringify(sampleRetrievalResponse), { status: 200 }),
    );
    const dispatcher = createDispatcher(fetchImpl);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "retrieval_search", arguments: { query: "anf latency" } },
    });

    const result = resultOf(response) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe("text");
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("1 passages (sanitized-only)");
    expect(text).toContain("[1] ANF overview (enterprise-public/public, score 0.9123)");
    expect(text).toContain("ANF provides low latency NFS volumes.");
    expect(text).toContain("Denied collections: enterprise-sensitive");
  });

  it("wraps upstream failures as isError tool results", async () => {
    const { fetchImpl } = stubFetch(() => new Response("boom", { status: 503 }));
    const dispatcher = createDispatcher(fetchImpl);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "retrieval_search", arguments: { query: "anf" } },
    });

    const result = resultOf(response) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("503");
  });

  it("rejects unknown tools with invalid params", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "does_not_exist", arguments: {} },
    });

    expect(response?.error?.code).toBe(-32602);
    expect(response?.error?.message).toContain("does_not_exist");
  });

  it("rejects unknown methods with method-not-found", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "resources/list",
    });

    expect(response?.error?.code).toBe(-32601);
  });

  it("answers ping and reports parse errors from raw lines", async () => {
    const dispatcher = createDispatcher(vi.fn() as unknown as typeof fetch);

    const pong = await dispatcher.dispatch({ jsonrpc: "2.0", id: 8, method: "ping" });
    const parseError = await dispatcher.dispatchLine("{not json");

    expect(resultOf(pong)).toEqual({});
    expect(parseError?.error?.code).toBe(-32700);
  });

  it("sends the Authorization header upstream when a token is configured", async () => {
    const { fetchImpl, calls } = stubFetch(
      () => new Response(JSON.stringify(sampleRetrievalResponse), { status: 200 }),
    );
    const dispatcher = createDispatcher(fetchImpl, { upstreamToken: "secret-token" });

    await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "retrieval_search", arguments: { query: "anf" } },
    });

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(calls[0]?.url).toBe("http://upstream.test/v1/query");
    expect(headers.authorization).toBe("Bearer secret-token");
  });

  it("never forwards principals from tool arguments to the upstream", async () => {
    const { fetchImpl, calls } = stubFetch(
      () => new Response(JSON.stringify(sampleRetrievalResponse), { status: 200 }),
    );
    const dispatcher = createDispatcher(fetchImpl);

    await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "retrieval_search",
        arguments: {
          query: "anf",
          role: "vault-agent",
          principals: ["group:supply-chain"],
        },
      },
    });

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.query).toBe("anf");
    expect(body.role).toBe("vault-agent");
    expect(Object.keys(body)).not.toContain("principals");
  });

  it("checks upstream health through retrieval_health", async () => {
    const { fetchImpl, calls } = stubFetch(
      () => new Response(JSON.stringify({ ok: true, service: "retrieval-api" }), { status: 200 }),
    );
    const dispatcher = createDispatcher(fetchImpl);

    const response = await dispatcher.dispatch({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "retrieval_health", arguments: {} },
    });

    const result = resultOf(response) as { content: Array<{ text: string }> };
    expect(calls[0]?.url).toBe("http://upstream.test/healthz");
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toEqual({
      ok: true,
      service: "retrieval-api",
    });
  });
});
