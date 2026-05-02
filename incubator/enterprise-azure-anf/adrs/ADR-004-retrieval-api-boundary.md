<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-004 Retrieval API Boundary

## Status

Accepted

## Decision

NemoClaw reaches enterprise knowledge through an internal retrieval API instead of direct unrestricted access to PostgreSQL or the raw ANF document share.

## Rationale

- it reduces coupling between the agent runtime and the data plane,
- it centralizes retrieval policy and evidence shaping,
- and it supports future ACL-aware authorization without rewriting NemoClaw core.

## Consequences

- the data plane must expose a stable internal interface,
- retrieval authorization becomes a service responsibility,
- agent-side enterprise logic stays thin.
