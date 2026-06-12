// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { loadConsoleConfig } from "../enterprise/services/console/src/config";
import {
  buildGroundedChatRequest,
  composeGroundedPrompt,
  extractAnswer,
} from "../enterprise/services/console/src/grounding";
import { createConsoleServer } from "../enterprise/services/console/src/server";

const sampleResults = [
  {
    id: "chunk-1",
    content: "ANF provides low latency NFS volumes.",
    sourceId: "anf.md",
    title: "ANF overview",
    collection: "enterprise-public",
    classification: "public",
    score: 0.9,
    metadata: {},
  },
  {
    id: "chunk-2",
    content: "Supplier pricing is listed in the BOM.",
    sourceId: "bom.xlsx",
    title: "Quarterly BOM",
    collection: "enterprise-sensitive",
    classification: "sensitive",
    score: 0.8,
    metadata: {},
  },
];

describe("nemomaxxing console", () => {
  it("loads config defaults aligned with the deployment manifests", () => {
    const config = loadConsoleConfig({});

    expect(config.port).toBe(8090);
    expect(config.retrievalApiUrl).toContain("retrieval-api.data-plane.svc.cluster.local");
    expect(config.chatEndpoint).toContain("nemotron-llm.inference.svc.cluster.local");
    expect(config.chatModel).toBe("nvidia/llama-3.1-nemotron-ultra-253b-v1");
  });

  it("composes a grounded prompt with numbered, classification-labeled passages", () => {
    const messages = composeGroundedPrompt("What is in the BOM?", sampleResults);

    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Answer ONLY from the numbered context");
    expect(messages[1]?.content).toContain("[1] (ANF overview — public)");
    expect(messages[1]?.content).toContain("[2] (Quarterly BOM — sensitive)");
    expect(messages[1]?.content).toContain("Question: What is in the BOM?");
  });

  it("states plainly when no passages were retrieved", () => {
    const messages = composeGroundedPrompt("anything", []);

    expect(messages[1]?.content).toContain("(no passages were retrieved)");
  });

  it("builds a deterministic OpenAI-compatible chat request", () => {
    const request = buildGroundedChatRequest("nvidia/test-model", "q", sampleResults);

    expect(request.model).toBe("nvidia/test-model");
    expect(request.temperature).toBe(0);
    expect(request.messages).toHaveLength(2);
  });

  it("extracts answers and rejects empty chat responses", () => {
    expect(extractAnswer({ choices: [{ message: { content: "hello" } }] })).toBe("hello");
    expect(() => extractAnswer({ choices: [] })).toThrow("did not include an answer");
  });

  it("orchestrates retrieval and chat through /api/chat", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("/v1/query")) {
        return new Response(
          JSON.stringify({
            groundingMode: "restricted-enterprise",
            policy: { filteredCollections: ["enterprise-sensitive"], deniedCollections: [] },
            results: sampleResults,
          }),
          { status: 200 },
        );
      }
      if (target.includes("/v1/chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "Grounded reply [1]" } }] }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const server = createConsoleServer({
      config: {
        host: "127.0.0.1",
        port: 0,
        retrievalApiUrl: "http://retrieval.test",
        chatEndpoint: "http://chat.test",
        chatModel: "nvidia/test-model",
        serviceName: "console-test",
      },
      fetchImpl,
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "What is in the BOM?",
          role: "vault-agent",
          principals: ["group:supply-chain"],
        }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.answer).toBe("Grounded reply [1]");
      expect(payload.model).toBe("nvidia/test-model");
      expect(payload.groundingMode).toBe("restricted-enterprise");
      expect(payload.results).toHaveLength(2);
    } finally {
      await server.close();
    }
  });

  it("rejects malformed chat requests", async () => {
    const server = createConsoleServer({
      config: {
        host: "127.0.0.1",
        port: 0,
        retrievalApiUrl: "http://retrieval.test",
        chatEndpoint: "http://chat.test",
        chatModel: "nvidia/test-model",
        serviceName: "console-test",
      },
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "vault-agent" }),
      });
      expect(response.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});
