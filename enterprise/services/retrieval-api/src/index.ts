// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createRetrievalBackendFromConfig } from "./backend-factory";
import { loadRetrievalApiConfig } from "./config";
import { createRetrievalApiServer } from "./server";

async function main() {
  const config = loadRetrievalApiConfig();
  const backend = await createRetrievalBackendFromConfig(config);
  const server = createRetrievalApiServer({
    backend,
    config,
  });
  await server.listen();
}

main().catch((error) => {
  console.error("retrieval-api failed to start", error);
  process.exitCode = 1;
});
