<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-005 Field Vault Role Separation

## Status

Accepted

## Decision

Field-agent and vault-agent separation is modeled as a first-class security pattern through role profiles and policy contracts.

## Rationale

- it fits the multi-agent security ideas in the research corpus,
- it creates a clear path for trust-zone isolation,
- and it avoids turning the pattern into a false new top-level product boundary.

## Consequences

- the incubator must define profile and bridge contracts,
- deployment assets should reflect low-trust and high-trust use cases,
- and future contributor skills must explain the pattern precisely.
