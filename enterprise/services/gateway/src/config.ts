// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export type GatewayAuthMode = "static" | "jwt";

export interface GatewayConfig {
  host: string;
  port: number;
  serviceName: string;
  retrievalApiUrl: string;
  authMode: GatewayAuthMode;
  /**
   * Static mode: JSON map of bearer token -> identity, e.g.
   * {"tok-123":{"subject":"svc:console","allowedRoles":["field-agent"],"principals":[]}}
   * Intended for development and single-tenant service wiring. Production
   * deployments should use jwt mode with an Entra ID (or compatible) issuer.
   */
  staticTokens: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwksUrl: string;
  /** Claim carrying group ids; each becomes a `group:<id>` principal. */
  groupsClaim: string;
  /** Claim carrying explicitly allowed roles; falls back to field-agent only. */
  rolesClaim: string;
  /** Requests per minute per subject; 0 disables rate limiting. */
  rateLimitPerMinute: number;
  /** Path for the JSONL audit trail; empty writes audit events to stdout. */
  auditLogPath: string;
  redactionEnabled: boolean;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const rawPort = Number(env.GATEWAY_PORT || "8095");
  return {
    host: env.GATEWAY_HOST || "0.0.0.0",
    port: Number.isFinite(rawPort) ? rawPort : 8095,
    serviceName: env.GATEWAY_SERVICE_NAME || "retrieval-gateway",
    retrievalApiUrl:
      env.RETRIEVAL_API_URL || "http://retrieval-api.data-plane.svc.cluster.local:8080",
    authMode: env.GATEWAY_AUTH_MODE === "jwt" ? "jwt" : "static",
    staticTokens: env.GATEWAY_STATIC_TOKENS || "{}",
    jwtIssuer: env.GATEWAY_JWT_ISSUER || "",
    jwtAudience: env.GATEWAY_JWT_AUDIENCE || "",
    jwksUrl: env.GATEWAY_JWKS_URL || "",
    groupsClaim: env.GATEWAY_GROUPS_CLAIM || "groups",
    rolesClaim: env.GATEWAY_ROLES_CLAIM || "roles",
    rateLimitPerMinute: Number.isFinite(Number(env.GATEWAY_RATE_LIMIT_PER_MINUTE))
      ? Number(env.GATEWAY_RATE_LIMIT_PER_MINUTE)
      : 120,
    auditLogPath: env.GATEWAY_AUDIT_LOG_PATH || "",
    redactionEnabled: env.GATEWAY_REDACTION !== "off",
  };
}
