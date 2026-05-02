<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-001 Incubator-first Repo Surface

## Status

Accepted

## Decision

The enterprise Azure ANF program lives first in `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/` and in hand-authored contributor assets, not in official user docs or generated `nemoclaw-user-*` skills.

## Rationale

- it reduces collision with upstream NemoClaw content,
- it preserves a safe place for evolving enterprise architecture,
- and it keeps planning, governance, and deployment work separate from official product claims.

## Consequences

- enterprise work remains additive by default,
- promotion into official docs becomes an explicit later step,
- contributor skills may point into the incubator without implying public support.
