// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  createMemoryStoreFromConfig,
  createRetrievalBackendFromConfig,
} from "./backend-factory.ts";
import { loadRetrievalApiConfig } from "./config.ts";
import { createRetrievalApiServer } from "./server.ts";

async function main() {
  const config = loadRetrievalApiConfig();
  const backend = await createRetrievalBackendFromConfig(config);
  const memoryStore = await createMemoryStoreFromConfig(config);
  const server = createRetrievalApiServer({
    backend,
    config,
    memoryStore,
  });
  await server.listen();
  console.log(`${config.serviceName} listening on ${config.host}:${config.port}`);

  const shutdown = (signal: string) => {
    console.log(`${config.serviceName} received ${signal}, draining`);
    server.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("retrieval-api failed to start", error);
  process.exitCode = 1;
});
