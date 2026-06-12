// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface ConsoleConfig {
  host: string;
  port: number;
  retrievalApiUrl: string;
  chatEndpoint: string;
  chatModel: string;
  serviceName: string;
}

export function loadConsoleConfig(env: NodeJS.ProcessEnv = process.env): ConsoleConfig {
  const rawPort = Number(env.CONSOLE_PORT || "8090");
  return {
    host: env.CONSOLE_HOST || "0.0.0.0",
    port: Number.isFinite(rawPort) ? rawPort : 8090,
    retrievalApiUrl:
      env.RETRIEVAL_API_URL || "http://retrieval-api.data-plane.svc.cluster.local:8080",
    chatEndpoint: env.CHAT_ENDPOINT || "http://nemotron-llm.inference.svc.cluster.local:8000",
    chatModel: env.CHAT_MODEL || "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    serviceName: env.CONSOLE_SERVICE_NAME || "nemomaxxing-console",
  };
}
