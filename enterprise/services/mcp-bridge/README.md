<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# NemoMaxxing MCP Bridge

The whitepaper's "MCP-to-ANF bridge" (Universal Translator), realized: a dependency-free MCP server that exposes the enterprise retrieval boundary as [Model Context Protocol](https://modelcontextprotocol.io) tools. Agents reach enterprise knowledge stored on Azure NetApp Files through standard MCP tool calls instead of custom API wiring — any MCP-capable agent runtime can ground on the corpus without knowing anything about PostgreSQL, pgvector, or the ANF document share.

The bridge speaks newline-delimited JSON-RPC 2.0 over **stdio** (the standard MCP transport for locally spawned servers). Each tool call crosses the retrieval boundary over HTTP; the bridge never touches the database or the document share directly, preserving the enterprise boundary.

## Tools

| Tool | Arguments | Purpose |
|---|---|---|
| `retrieval_search` | `query` (required), `role` (`field-agent`/`vault-agent`), `collections`, `maxResults` (1–20) | Role-aware search through the retrieval boundary. Returns numbered passages with title, collection, classification, and score, plus any denied collections. |
| `retrieval_health` | none | Health check of the upstream retrieval boundary. |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MCP_UPSTREAM_URL` | `http://retrieval-gateway.data-plane.svc.cluster.local:8095` | Upstream retrieval boundary (gateway or retrieval API) |
| `MCP_UPSTREAM_TOKEN` | unset | When set, sent upstream as `Authorization: Bearer <token>` |
| `MCP_DEFAULT_ROLE` | `field-agent` | Role used by `retrieval_search` when the caller omits one (`vault-agent` to escalate the default) |
| `MCP_SERVICE_NAME` | `nemomaxxing-mcp-bridge` | Server identity reported during the MCP handshake |

## Why principals are not a tool argument

The retrieval API accepts `principals` so trusted callers can attach identity to a query. The bridge deliberately never accepts or forwards principals from tool arguments: a language model choosing its own principals would be self-asserted identity, which defeats ACL enforcement. Identity belongs to the gateway — the upstream derives principals from the authenticated session (for example, from the bearer token), and the bridge only carries the query, role, collections, and result limit. Anything named `principals` in tool arguments is ignored.

## Run

```bash
npm start
```

The bridge logs its startup line to stderr; stdout is reserved for the MCP protocol. MCP clients typically spawn the server themselves, for example:

```json
{
  "mcpServers": {
    "nemomaxxing-retrieval": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/mcp-bridge/src/index.ts"],
      "env": { "MCP_UPSTREAM_URL": "http://127.0.0.1:8080" }
    }
  }
}
```

## End-To-End Validation

Requires a bootstrapped `RETRIEVAL_API_DATABASE_URL` (see the retrieval API README):

```bash
npm run e2e:local
```

This seeds a mixed-sensitivity corpus (one public chunk, one ACL-restricted chunk), runs a mock embedding/ranking NIM, boots the real retrieval API, spawns the bridge over stdio pipes, and asserts the MCP handshake, tool discovery, field-agent ACL enforcement, denied-collection reporting, and upstream health through the tool surface.
