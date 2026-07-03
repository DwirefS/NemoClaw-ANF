// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createAuditWriter } from "./audit.ts";
import { loadGatewayConfig } from "./config.ts";
import { createIdentityResolver } from "./identity.ts";
import { createMetrics } from "./metrics.ts";
import { createRateLimiter } from "./ratelimit.ts";
import { createGatewayServer } from "./server.ts";

async function main() {
  const config = loadGatewayConfig();
  const server = createGatewayServer({
    config,
    identityResolver: createIdentityResolver(config),
    auditWriter: createAuditWriter(config.auditLogPath),
    metrics: createMetrics(),
    rateLimiter: createRateLimiter(config.rateLimitPerMinute),
  });
  await server.listen();
  console.log(
    `${config.serviceName} listening on ${config.host}:${config.port} (auth: ${config.authMode})`,
  );

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
  console.error("gateway failed to start", error);
  process.exitCode = 1;
});
