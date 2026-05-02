<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Disaster Recovery And Rollback

## Scope

This runbook covers the overlay recovery model for:

- PostgreSQL data and WAL
- selected agent state volumes
- shared NIM cache volumes when rebuild time matters
- retrieval API and guardrails redeploy

## Recovery Order

1. recover ANF-backed database state
2. restore or redeploy retrieval API
3. restore or redeploy guardrails and NIM services
4. restore worker-tier runtime connectivity
5. validate grounded response flow end to end

## Rollback Rule

Rollback should happen at service and storage boundaries, not by mutating upstream NemoClaw code in place.

## Operator Checklist

- confirm the affected trust zone
- identify the last known good snapshot or replica state
- restore database state before agent-side state
- validate retrieval and guardrails before reopening user traffic
