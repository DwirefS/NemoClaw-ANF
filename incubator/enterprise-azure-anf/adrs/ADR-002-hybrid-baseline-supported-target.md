<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-002 Hybrid Baseline Supported Target

## Status

Accepted

## Decision

The supported baseline uses AKS for the RAG and data plane and a separate worker or VM tier for NemoClaw/OpenShell.

## Rationale

- it aligns better with current upstream runtime expectations,
- it minimizes premature AKS-native assumptions,
- and it reduces entanglement between enterprise deployment logic and NemoClaw core.

## Consequences

- full AKS-hosted NemoClaw stays experimental,
- deployment assets must model a split topology,
- contributors should not assume cluster-native agent orchestration already exists upstream.
