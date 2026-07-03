// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createPublicKey, verify as cryptoVerify, type KeyObject } from "node:crypto";
import type { GatewayConfig } from "./config.ts";

export type AgentRole = "field-agent" | "vault-agent";

export interface GatewayIdentity {
  subject: string;
  allowedRoles: AgentRole[];
  principals: string[];
}

export interface IdentityResolver {
  resolve(bearerToken: string): Promise<GatewayIdentity | null>;
}

function isAgentRole(value: unknown): value is AgentRole {
  return value === "field-agent" || value === "vault-agent";
}

function coerceIdentity(subject: string, roles: unknown, principals: unknown): GatewayIdentity {
  const allowedRoles = Array.isArray(roles) ? roles.filter(isAgentRole) : [];
  return {
    subject,
    // An identity with no recognized roles gets the least-privileged role.
    allowedRoles: allowedRoles.length > 0 ? allowedRoles : ["field-agent"],
    principals: Array.isArray(principals)
      ? principals.filter((value): value is string => typeof value === "string" && value !== "")
      : [],
  };
}

export function createStaticIdentityResolver(staticTokensJson: string): IdentityResolver {
  let parsed: Record<string, { subject?: string; allowedRoles?: unknown; principals?: unknown }>;
  try {
    parsed = JSON.parse(staticTokensJson);
  } catch {
    throw new Error("GATEWAY_STATIC_TOKENS is not valid JSON.");
  }

  return {
    async resolve(bearerToken: string) {
      const record = parsed[bearerToken];
      if (!record) {
        return null;
      }
      return coerceIdentity(
        record.subject || "static-client",
        record.allowedRoles,
        record.principals,
      );
    },
  };
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nbf?: number;
  [claim: string]: unknown;
}

interface JwksKey {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

export interface JwtResolverOptions {
  fetchImpl?: typeof fetch;
  /** Test seam: bypass JWKS fetching with a fixed key set. */
  keys?: Map<string, KeyObject>;
}

/**
 * RS256 JWT verification against a JWKS endpoint (the Entra ID /
 * OpenID Connect pattern). Principals come from the groups claim as
 * `group:<id>` plus the subject as `user:<sub>`; allowed roles come from
 * the roles claim and default to field-agent.
 */
export function createJwtIdentityResolver(
  config: GatewayConfig,
  options: JwtResolverOptions = {},
): IdentityResolver {
  const fetchImpl = options.fetchImpl ?? fetch;
  const keyCache = options.keys ?? new Map<string, KeyObject>();
  let lastJwksFetch = 0;

  async function keyForKid(kid: string): Promise<KeyObject | null> {
    if (keyCache.has(kid)) {
      return keyCache.get(kid) ?? null;
    }
    // Refresh at most once per minute so unknown kids cannot stampede JWKS.
    const now = Date.now();
    if (options.keys || (lastJwksFetch !== 0 && now - lastJwksFetch < 60_000)) {
      return null;
    }
    lastJwksFetch = now;
    const response = await fetchImpl(config.jwksUrl);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status}`);
    }
    const body = (await response.json()) as { keys?: JwksKey[] };
    for (const key of body.keys ?? []) {
      if (key.kty === "RSA" && key.kid && key.n && key.e) {
        keyCache.set(
          key.kid,
          createPublicKey({ key: { kty: "RSA", n: key.n, e: key.e }, format: "jwk" }),
        );
      }
    }
    return keyCache.get(kid) ?? null;
  }

  return {
    async resolve(bearerToken: string) {
      const segments = bearerToken.split(".");
      if (segments.length !== 3) {
        return null;
      }
      let header: JwtHeader;
      let claims: JwtClaims;
      try {
        header = decodeSegment<JwtHeader>(segments[0] ?? "");
        claims = decodeSegment<JwtClaims>(segments[1] ?? "");
      } catch {
        return null;
      }
      if (header.alg !== "RS256" || !header.kid) {
        return null;
      }

      const key = await keyForKid(header.kid);
      if (!key) {
        return null;
      }
      const signed = `${segments[0]}.${segments[1]}`;
      const signature = Buffer.from(segments[2] ?? "", "base64url");
      if (!cryptoVerify("RSA-SHA256", Buffer.from(signed), key, signature)) {
        return null;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
        return null;
      }
      if (typeof claims.nbf === "number" && claims.nbf > nowSeconds) {
        return null;
      }
      if (config.jwtIssuer && claims.iss !== config.jwtIssuer) {
        return null;
      }
      if (config.jwtAudience) {
        const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (!audiences.includes(config.jwtAudience)) {
          return null;
        }
      }

      const subject = typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : "unknown";
      const groups = claims[config.groupsClaim];
      const principals = Array.isArray(groups)
        ? groups
            .filter((value): value is string => typeof value === "string" && value !== "")
            .map((group) => `group:${group}`)
        : [];
      principals.push(`user:${subject}`);

      const identity = coerceIdentity(subject, claims[config.rolesClaim], principals);
      return identity;
    },
  };
}

export function createIdentityResolver(
  config: GatewayConfig,
  options: JwtResolverOptions = {},
): IdentityResolver {
  if (config.authMode === "jwt") {
    if (!config.jwksUrl && !options.keys) {
      throw new Error("GATEWAY_JWKS_URL is required when GATEWAY_AUTH_MODE=jwt.");
    }
    return createJwtIdentityResolver(config, options);
  }
  return createStaticIdentityResolver(config.staticTokens);
}
