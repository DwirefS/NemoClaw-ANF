// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export type BridgeRole = "field-agent" | "vault-agent";

export interface McpBridgeConfig {
  /** Base URL of the upstream retrieval boundary (gateway or retrieval API). */
  upstreamUrl: string;
  /** Optional bearer token sent to the upstream as an Authorization header. */
  upstreamToken?: string;
  /** Role used for retrieval_search when the caller does not specify one. */
  defaultRole: BridgeRole;
  serviceName: string;
  serviceVersion: string;
}

export function loadMcpBridgeConfig(env: NodeJS.ProcessEnv = process.env): McpBridgeConfig {
  return {
    upstreamUrl:
      env.MCP_UPSTREAM_URL || "http://retrieval-gateway.data-plane.svc.cluster.local:8095",
    upstreamToken: env.MCP_UPSTREAM_TOKEN,
    defaultRole: env.MCP_DEFAULT_ROLE === "vault-agent" ? "vault-agent" : "field-agent",
    serviceName: env.MCP_SERVICE_NAME || "nemomaxxing-mcp-bridge",
    serviceVersion: "0.1.0",
  };
}
