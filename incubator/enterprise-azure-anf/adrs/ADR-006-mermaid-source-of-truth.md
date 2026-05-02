<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-006 Mermaid Source Of Truth

## Status

Accepted

## Decision

Mermaid `.mmd` files are the canonical diagram sources in this incubator. PNG files are rendered companions only.

## Rationale

- textual diagrams are easier to diff and review,
- source control stays cleaner,
- and diagram intent can evolve alongside specs and ADRs.

## Consequences

- contributors must edit Mermaid sources, not image renders,
- any future rendering workflow should treat PNGs as outputs,
- and references should point to Mermaid sources first.
