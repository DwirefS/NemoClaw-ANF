<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Secure Gateway

The policy-enforcement seam from the whitepaper's field/vault architecture, realized as a service in front of the retrieval API. It closes the overlay's largest security gap: before the gateway, the retrieval API had to trust whatever principals a caller asserted; with the gateway, principals are derived from the authenticated identity and the caller's body can never escalate access.

Duties (per the secure-gateway board in `artifacts/enterprise-azure-anf/`):

- **Access control** — bearer authentication (static tokens for development and service wiring; RS256 JWT against a JWKS endpoint for Entra ID-style production identity), role grants per identity, and per-subject rate limiting.
- **Policy enforcement** — the requested role must be granted to the identity; principals are always identity-derived; body-supplied principals are discarded.
- **Redaction & masking** — sanitized-only (low-trust) responses pass through an output filter that masks emails, phone numbers, card-shaped numbers, and API-key-shaped secrets. Defense in depth on top of collection and ACL policy, never a substitute for it.
- **Audit logging** — every decision (allow and deny) is written as a JSONL event carrying subject, role, principals, a SHA-256 query hash (never the raw query), returned chunk ids, redaction count, and latency.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GATEWAY_HOST` / `GATEWAY_PORT` | `0.0.0.0` / `8095` | Listen address |
| `RETRIEVAL_API_URL` | `http://retrieval-api.data-plane.svc.cluster.local:8080` | Upstream boundary |
| `GATEWAY_AUTH_MODE` | `static` | `static` or `jwt` |
| `GATEWAY_STATIC_TOKENS` | `{}` | JSON map: token → `{subject, allowedRoles, principals}` |
| `GATEWAY_JWT_ISSUER` / `GATEWAY_JWT_AUDIENCE` / `GATEWAY_JWKS_URL` | — | JWT validation (RS256) |
| `GATEWAY_GROUPS_CLAIM` | `groups` | Claim mapped to `group:<id>` principals |
| `GATEWAY_ROLES_CLAIM` | `roles` | Claim carrying granted agent roles |
| `GATEWAY_RATE_LIMIT_PER_MINUTE` | `120` | Per-subject budget; `0` disables |
| `GATEWAY_AUDIT_LOG_PATH` | stdout | JSONL audit destination |
| `GATEWAY_REDACTION` | on | `off` disables output masking |

## HTTP Surface

- `POST /v1/query` — authenticated retrieval; same body as the retrieval API minus `principals` (ignored if sent)
- `GET /healthz` — liveness
- `GET /readyz` — checks the upstream retrieval API
- `GET /metrics` — Prometheus text format: `gateway_requests_total`, `gateway_denied_total`, `gateway_redactions_total`, latency histogram

## End-To-End Validation

Requires a bootstrapped `RETRIEVAL_API_DATABASE_URL`:

```bash
npm run e2e:local
```

Proves against the live stack: 401 on missing/unknown tokens, 403 on ungranted roles, identity principals unlocking ACL chunks with no principals in the body, body-principal escalation blocked, redaction of emails and phone numbers in sanitized responses, rate limiting, audit-trail integrity (query hash, no raw query), and metrics exposure.

## Production Notes

- Run in `jwt` mode with your Entra ID tenant: set issuer, audience, and the tenant JWKS URL; grant `vault-agent` through the roles claim in app role assignments.
- Downstream network policy should make the retrieval API reachable only from the gateway; the deployment manifests wire this.
- Static-token mode remains appropriate for machine identities on the worker tier until federated workload identity is wired end to end.
