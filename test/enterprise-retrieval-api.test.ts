// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createRetrievalApiServer } from "../enterprise/services/retrieval-api/src/server";
import { createStaticBackend } from "../enterprise/services/retrieval-api/src/backend";
import type { RetrievalResult } from "../enterprise/services/retrieval-api/src/contracts";

const runningServers: Array<{ close: () => Promise<void> }> = [];

async function startServer(seedResults: RetrievalResult[] = []) {
  const server = createRetrievalApiServer({
    backend: createStaticBackend(seedResults),
    config: {
      host: "127.0.0.1",
      port: 0,
      profileMode: "hybrid",
      serviceName: "retrieval-api-test",
    },
  });

  await server.listen();
  runningServers.push(server);
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
  };
}

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await server.close();
    }
  }
});

describe("enterprise retrieval API", () => {
  it("serves a health endpoint", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "retrieval-api-test",
    });
  });

  it("rejects malformed query requests", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        role: "field-agent",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
  });

  it("filters field-agent requests to sanitized corpora and exposes policy metadata", async () => {
    const { baseUrl } = await startServer([
      {
        id: "doc-public-1",
        content: "Sanitized release note",
        sourceId: "release-note-1",
        title: "Release Note",
        collection: "enterprise-public",
        classification: "internal-sanitized",
        score: 0.91,
        metadata: {
          filename: "release-note.md",
        },
      },
    ]);

    const response = await fetch(`${baseUrl}/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "What changed in the last release?",
        role: "field-agent",
        collections: ["enterprise-public", "enterprise-sensitive"],
        maxResults: 6,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      role: "field-agent",
      groundingMode: "sanitized-only",
      policy: {
        directDatabaseAccess: false,
        directDocumentShareAccess: false,
        filteredCollections: ["enterprise-public"],
        deniedCollections: ["enterprise-sensitive"],
      },
      results: [
        {
          id: "doc-public-1",
          collection: "enterprise-public",
        },
      ],
    });
  });

  it("allows vault-agent requests to use restricted corpora", async () => {
    const { baseUrl } = await startServer([
      {
        id: "doc-sensitive-1",
        content: "Restricted financial forecast",
        sourceId: "finance-forecast-q4",
        title: "Forecast",
        collection: "enterprise-sensitive",
        classification: "finance-sensitive",
        score: 0.97,
        metadata: {
          filename: "forecast.xlsx",
        },
      },
    ]);

    const response = await fetch(`${baseUrl}/v1/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "Summarize the Q4 forecast variance",
        role: "vault-agent",
        collections: ["enterprise-sensitive"],
        maxResults: 3,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      role: "vault-agent",
      groundingMode: "restricted-enterprise",
      policy: {
        filteredCollections: ["enterprise-sensitive"],
        deniedCollections: [],
      },
      results: [
        {
          id: "doc-sensitive-1",
          collection: "enterprise-sensitive",
        },
      ],
    });
  });
});
