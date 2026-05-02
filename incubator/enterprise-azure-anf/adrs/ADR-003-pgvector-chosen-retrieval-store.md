<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# ADR-003 Pgvector Chosen Retrieval Store

## Status

Accepted

## Decision

PostgreSQL with `pgvector` is the chosen retrieval store for the incubator baseline.

## Rationale

- it supports vector and full-text retrieval in one operational surface,
- it maps well to enterprise PostgreSQL operating knowledge,
- and it matches the desired ANF-backed persistence story.

## Consequences

- the overlay owns any integration work not already handled by stock NVIDIA RAG paths,
- benchmarking is required,
- and schema, index, and retrieval tuning become first-class implementation tasks.
