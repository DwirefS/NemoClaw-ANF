// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// MCP stdio entrypoint: newline-delimited JSON-RPC 2.0 in on stdin, responses
// out on stdout. stdout is the protocol channel — all diagnostics go to
// stderr so client parsers never see non-protocol output.

import readline from "node:readline";
import { loadMcpBridgeConfig } from "./config.ts";
import { createMcpDispatcher } from "./protocol.ts";
import { createBridgeTools } from "./tools.ts";

const config = loadMcpBridgeConfig();
const dispatcher = createMcpDispatcher({
  serverInfo: { name: config.serviceName, version: config.serviceVersion },
  tools: createBridgeTools({ config }),
});

console.error(
  `${config.serviceName} ${config.serviceVersion} speaking MCP over stdio (upstream: ${config.upstreamUrl})`,
);

const input = readline.createInterface({ input: process.stdin, terminal: false });

// Serialize responses so concurrent tool calls cannot interleave on stdout.
let pipeline: Promise<void> = Promise.resolve();

input.on("line", (line) => {
  if (line.trim() === "") {
    return;
  }
  pipeline = pipeline.then(async () => {
    const response = await dispatcher.dispatchLine(line);
    if (response !== null) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
});

input.on("close", () => {
  void pipeline.then(() => {
    process.exit(0);
  });
});
