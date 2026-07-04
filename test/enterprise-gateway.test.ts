// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { hashQuery } from "../enterprise/services/gateway/src/audit";
import { loadGatewayConfig } from "../enterprise/services/gateway/src/config";
import {
  createJwtIdentityResolver,
  createStaticIdentityResolver,
} from "../enterprise/services/gateway/src/identity";
import { createMetrics } from "../enterprise/services/gateway/src/metrics";
import { createRateLimiter } from "../enterprise/services/gateway/src/ratelimit";
import { redactText } from "../enterprise/services/gateway/src/redaction";

function base64url(input: object | Buffer): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
  return buffer.toString("base64url");
}

function signJwt(privateKey: KeyObject, kid: string, claims: Record<string, unknown>): string {
  const header = base64url({ alg: "RS256", typ: "JWT", kid });
  const payload = base64url(claims);
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("enterprise secure gateway", () => {
  it("loads config defaults aligned with the deployment manifests", () => {
    const config = loadGatewayConfig({});

    expect(config.port).toBe(8095);
    expect(config.authMode).toBe("static");
    expect(config.rateLimitPerMinute).toBe(120);
    expect(config.redactionEnabled).toBe(true);
  });

  it("resolves static tokens to identities and rejects unknown tokens", async () => {
    const resolver = createStaticIdentityResolver(
      JSON.stringify({
        "tok-1": {
          subject: "svc:console",
          allowedRoles: ["field-agent", "vault-agent"],
          principals: ["group:ops"],
        },
      }),
    );

    const identity = await resolver.resolve("tok-1");
    expect(identity?.subject).toBe("svc:console");
    expect(identity?.allowedRoles).toEqual(["field-agent", "vault-agent"]);
    expect(identity?.principals).toEqual(["group:ops"]);
    await expect(resolver.resolve("nope")).resolves.toBeNull();
  });

  it("defaults identities without recognized roles to least privilege", async () => {
    const resolver = createStaticIdentityResolver(
      JSON.stringify({ "tok-2": { subject: "svc:x", allowedRoles: ["superuser"] } }),
    );

    const identity = await resolver.resolve("tok-2");
    expect(identity?.allowedRoles).toEqual(["field-agent"]);
  });

  it("verifies RS256 JWTs and derives principals from groups and subject", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const config = loadGatewayConfig({
      GATEWAY_AUTH_MODE: "jwt",
      GATEWAY_JWT_ISSUER: "https://login.example.test/tenant",
      GATEWAY_JWT_AUDIENCE: "api://nemomaxxing",
    });
    const resolver = createJwtIdentityResolver(config, {
      keys: new Map([["kid-1", publicKey]]),
    });

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(privateKey, "kid-1", {
      iss: "https://login.example.test/tenant",
      aud: "api://nemomaxxing",
      sub: "alice@example.test",
      exp: now + 300,
      groups: ["supply-chain", "finance"],
      roles: ["vault-agent"],
    });

    const identity = await resolver.resolve(token);
    expect(identity?.subject).toBe("alice@example.test");
    expect(identity?.allowedRoles).toEqual(["vault-agent"]);
    expect(identity?.principals).toEqual([
      "group:supply-chain",
      "group:finance",
      "user:alice@example.test",
    ]);
  });

  it("rejects expired, wrong-issuer, wrong-audience, and tampered JWTs", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const config = loadGatewayConfig({
      GATEWAY_AUTH_MODE: "jwt",
      GATEWAY_JWT_ISSUER: "https://login.example.test/tenant",
      GATEWAY_JWT_AUDIENCE: "api://nemomaxxing",
    });
    const resolver = createJwtIdentityResolver(config, {
      keys: new Map([["kid-1", publicKey]]),
    });
    const now = Math.floor(Date.now() / 1000);
    const base = {
      iss: "https://login.example.test/tenant",
      aud: "api://nemomaxxing",
      sub: "alice",
      exp: now + 300,
    };

    await expect(
      resolver.resolve(signJwt(privateKey, "kid-1", { ...base, exp: now - 10 })),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve(signJwt(privateKey, "kid-1", { ...base, iss: "https://evil.test" })),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve(signJwt(privateKey, "kid-1", { ...base, aud: "api://other" })),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve(signJwt(other.privateKey, "kid-1", base)),
    ).resolves.toBeNull();
  });

  it("redacts emails, keys, card numbers, and phone numbers", () => {
    const { text, redactions } = redactText(
      "Mail ops-team@example.com, key nvapi-abcdefghijklmnop123456, card 4111 1111 1111 1111, call +1 (555) 123-4567.",
    );

    expect(text).toContain("[redacted-email]");
    expect(text).toContain("[redacted-key]");
    expect(text).toContain("[redacted-number]");
    expect(text).toContain("[redacted-phone]");
    expect(text).not.toContain("example.com");
    expect(redactions).toBeGreaterThanOrEqual(4);
  });

  it("rate limits per subject with token-bucket refill", () => {
    let clock = 0;
    const limiter = createRateLimiter(2, () => clock);

    expect(limiter.allow("alice")).toBe(true);
    expect(limiter.allow("alice")).toBe(true);
    expect(limiter.allow("alice")).toBe(false);
    expect(limiter.allow("bob")).toBe(true);
    clock += 30_000;
    expect(limiter.allow("alice")).toBe(true);
  });

  it("hashes queries for the audit trail instead of storing raw text", () => {
    const hash = hashQuery("what is in the BOM?");

    expect(hash).toHaveLength(32);
    expect(hash).not.toContain("BOM");
    expect(hashQuery("what is in the BOM?")).toBe(hash);
  });

  it("renders Prometheus metrics with counters and latency histogram", () => {
    const metrics = createMetrics();
    metrics.recordRequest("field-agent", 200, 42);
    metrics.recordDenied("invalid_token");
    metrics.recordRedactions(3);

    const text = metrics.render();
    expect(text).toContain('gateway_requests_total{role="field-agent",status="200"} 1');
    expect(text).toContain('gateway_denied_total{reason="invalid_token"} 1');
    expect(text).toContain("gateway_redactions_total 3");
    expect(text).toContain('gateway_request_duration_ms_bucket{le="50"} 1');
    expect(text).toContain("gateway_request_duration_ms_count 1");
  });

  it("serves RFC 9728 metadata and an A2A agent card", async () => {
    const { createGatewayServer } = await import("../enterprise/services/gateway/src/server");
    const { createAuditWriter } = await import("../enterprise/services/gateway/src/audit");
    const config = loadGatewayConfig({
      GATEWAY_PORT: "0",
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_AUTH_MODE: "jwt",
      GATEWAY_JWT_ISSUER: "https://login.example.test/tenant",
      GATEWAY_JWKS_URL: "https://login.example.test/keys",
      GATEWAY_PUBLIC_URL: "https://gw.example.test",
    });
    const server = createGatewayServer({
      config,
      identityResolver: { resolve: async () => null },
      auditWriter: createAuditWriter(""),
      metrics: createMetrics(),
      rateLimiter: createRateLimiter(0),
    });
    await server.listen();
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const metadata = (await (
        await fetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`)
      ).json()) as { resource: string; authorization_servers: string[] };
      expect(metadata.resource).toBe("https://gw.example.test");
      expect(metadata.authorization_servers).toEqual(["https://login.example.test/tenant"]);

      const card = (await (
        await fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`)
      ).json()) as { name: string; skills: Array<{ id: string }> };
      expect(card.name).toBe("retrieval-gateway");
      expect(card.skills.map((skill) => skill.id)).toContain("retrieval_search");
    } finally {
      await server.close();
    }
  });

  it("keeps the vi mock typing pattern for future request-level tests", () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      return new Response("{}", { status: 200 });
    });
    expect(typeof fetchImpl).toBe("function");
  });
});
