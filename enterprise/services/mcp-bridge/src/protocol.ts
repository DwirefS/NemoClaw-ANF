// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Minimal MCP server protocol: JSON-RPC 2.0 request dispatch for the subset of
// the Model Context Protocol needed to expose tools (initialize, ping,
// tools/list, tools/call). Transport-agnostic: the dispatcher consumes parsed
// messages (or raw lines) and returns response objects, so unit tests can
// drive it directly and src/index.ts can wire it to stdio.

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const JSON_RPC_PARSE_ERROR = -32700;
export const JSON_RPC_INVALID_REQUEST = -32600;
export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INVALID_PARAMS = -32602;

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object describing the tool arguments. */
  inputSchema: Record<string, unknown>;
  handler(args: Record<string, unknown>): Promise<string>;
}

export interface JsonRpcError {
  code: number;
  message: string;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface McpDispatcher {
  /** Dispatch a parsed JSON-RPC message. Returns null for notifications. */
  dispatch(message: unknown): Promise<JsonRpcResponse | null>;
  /** Parse one newline-delimited JSON line and dispatch it. */
  dispatchLine(line: string): Promise<JsonRpcResponse | null>;
}

export interface CreateMcpDispatcherOptions {
  serverInfo: McpServerInfo;
  tools: McpToolDefinition[];
}

function resultResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createMcpDispatcher(options: CreateMcpDispatcherOptions): McpDispatcher {
  const { serverInfo, tools } = options;

  async function callTool(
    id: string | number | null,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse> {
    const name = params.name;
    if (typeof name !== "string") {
      return errorResponse(id, JSON_RPC_INVALID_PARAMS, "tools/call requires a string tool name");
    }
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      return errorResponse(id, JSON_RPC_INVALID_PARAMS, `Unknown tool: ${name}`);
    }
    const rawArguments = params.arguments ?? {};
    if (!isPlainObject(rawArguments)) {
      return errorResponse(id, JSON_RPC_INVALID_PARAMS, "tool arguments must be an object");
    }
    try {
      const text = await tool.handler(rawArguments);
      return resultResponse(id, { content: [{ type: "text", text }] });
    } catch (error) {
      // Tool execution failures are reported inside the tool result, per MCP,
      // so the model can read the failure and adjust.
      const message = error instanceof Error ? error.message : String(error);
      return resultResponse(id, { content: [{ type: "text", text: message }], isError: true });
    }
  }

  async function dispatch(message: unknown): Promise<JsonRpcResponse | null> {
    if (!isPlainObject(message) || typeof message.method !== "string") {
      return errorResponse(null, JSON_RPC_INVALID_REQUEST, "Invalid JSON-RPC request");
    }

    const method = message.method;
    const hasId = typeof message.id === "string" || typeof message.id === "number";
    const id = hasId ? (message.id as string | number) : null;
    const params = isPlainObject(message.params) ? message.params : {};

    // Notifications (no id) never produce a response.
    if (!hasId) {
      return null;
    }

    switch (method) {
      case "initialize": {
        const requestedVersion = params.protocolVersion;
        return resultResponse(id, {
          protocolVersion:
            typeof requestedVersion === "string" ? requestedVersion : MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: serverInfo.name, version: serverInfo.version },
        });
      }
      case "ping":
        return resultResponse(id, {});
      case "tools/list":
        return resultResponse(id, {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        });
      case "tools/call":
        return callTool(id, params);
      default:
        return errorResponse(id, JSON_RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  async function dispatchLine(line: string): Promise<JsonRpcResponse | null> {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return errorResponse(null, JSON_RPC_PARSE_ERROR, "Parse error");
    }
    return dispatch(message);
  }

  return { dispatch, dispatchLine };
}
