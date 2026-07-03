// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// The bridge's MCP tool set. Every tool crosses the enterprise retrieval
// boundary over HTTP; the bridge itself never touches PostgreSQL or the ANF
// document share. Identity principals are deliberately NOT accepted as tool
// arguments: they are derived from the authenticated identity by the gateway,
// never asserted by the model.

import type { BridgeRole, McpBridgeConfig } from "./config.ts";
import type { McpToolDefinition } from "./protocol.ts";

export interface CreateBridgeToolsOptions {
  config: McpBridgeConfig;
  fetchImpl?: typeof fetch;
}

interface RetrievalResult {
  id: string;
  content: string;
  sourceId: string;
  title: string;
  collection: string;
  classification: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface RetrievalResponseBody {
  queryId: string;
  role: BridgeRole;
  groundingMode: string;
  policy: {
    filteredCollections: string[];
    deniedCollections: string[];
  };
  results: RetrievalResult[];
}

const MAX_RESULTS_LIMIT = 20;

export function formatSearchResults(payload: RetrievalResponseBody): string {
  const lines: string[] = [];
  lines.push(`${payload.results.length} passages (${payload.groundingMode})`);
  payload.results.forEach((result, index) => {
    lines.push(
      `[${index + 1}] ${result.title} (${result.collection}/${result.classification}, score ${result.score.toFixed(4)})`,
    );
    lines.push(result.content);
  });
  if (payload.policy.deniedCollections.length > 0) {
    lines.push(`Denied collections: ${payload.policy.deniedCollections.join(", ")}`);
  }
  return lines.join("\n");
}

export function createBridgeTools(options: CreateBridgeToolsOptions): McpToolDefinition[] {
  const { config } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = config.upstreamUrl.replace(/\/$/, "");

  function upstreamHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (config.upstreamToken) {
      headers.authorization = `Bearer ${config.upstreamToken}`;
    }
    return headers;
  }

  async function retrievalSearch(args: Record<string, unknown>): Promise<string> {
    if (typeof args.query !== "string" || args.query.trim() === "") {
      throw new Error("retrieval_search requires a non-empty string 'query' argument");
    }
    let role: BridgeRole = config.defaultRole;
    if (args.role !== undefined) {
      if (args.role !== "field-agent" && args.role !== "vault-agent") {
        throw new Error("'role' must be either 'field-agent' or 'vault-agent'");
      }
      role = args.role;
    }
    let collections: string[] | undefined;
    if (args.collections !== undefined) {
      if (
        !Array.isArray(args.collections) ||
        !args.collections.every((entry) => typeof entry === "string")
      ) {
        throw new Error("'collections' must be an array of strings");
      }
      collections = args.collections;
    }
    let maxResults: number | undefined;
    if (args.maxResults !== undefined) {
      if (
        typeof args.maxResults !== "number" ||
        !Number.isInteger(args.maxResults) ||
        args.maxResults < 1 ||
        args.maxResults > MAX_RESULTS_LIMIT
      ) {
        throw new Error(`'maxResults' must be an integer between 1 and ${MAX_RESULTS_LIMIT}`);
      }
      maxResults = args.maxResults;
    }

    // Note: principals are intentionally never read from the tool arguments
    // and never forwarded. Attaching identity is the upstream gateway's job.
    const response = await fetchImpl(`${baseUrl}/v1/query`, {
      method: "POST",
      headers: upstreamHeaders(),
      body: JSON.stringify({ query: args.query, role, collections, maxResults }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `Retrieval upstream returned ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    const payload = (await response.json()) as RetrievalResponseBody;
    return formatSearchResults(payload);
  }

  async function retrievalHealth(): Promise<string> {
    const response = await fetchImpl(`${baseUrl}/healthz`, {
      method: "GET",
      headers: upstreamHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Retrieval upstream health check returned ${response.status}`);
    }
    return JSON.stringify(await response.json());
  }

  return [
    {
      name: "retrieval_search",
      description:
        "Search the enterprise knowledge base through the NemoMaxxing retrieval boundary. " +
        "Results are role-aware: policy filtering and ACL enforcement happen upstream, so " +
        "only passages the calling role is entitled to see are returned. Identity principals " +
        "are attached by the gateway from the authenticated session and cannot be supplied here.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language search query.",
          },
          role: {
            type: "string",
            enum: ["field-agent", "vault-agent"],
            description:
              "Retrieval role. field-agent grounds only on sanitized/public collections; " +
              "vault-agent may reach restricted collections subject to upstream ACLs. " +
              `Defaults to the bridge's configured role (${options.config.defaultRole}).`,
          },
          collections: {
            type: "array",
            items: { type: "string" },
            description: "Optional collection names to search. Denied collections are reported.",
          },
          maxResults: {
            type: "integer",
            minimum: 1,
            maximum: MAX_RESULTS_LIMIT,
            description: "Maximum number of passages to return.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: retrievalSearch,
    },
    {
      name: "retrieval_health",
      description:
        "Check the health of the upstream enterprise retrieval boundary and return its status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      handler: retrievalHealth,
    },
  ];
}
