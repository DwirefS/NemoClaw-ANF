// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { loadConsoleConfig } from "./config.ts";
import { createConsoleServer } from "./server.ts";

async function main() {
  const config = loadConsoleConfig();
  const server = createConsoleServer({ config });
  await server.listen();
  console.log(`${config.serviceName} listening on ${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error("console failed to start", error);
  process.exitCode = 1;
});
