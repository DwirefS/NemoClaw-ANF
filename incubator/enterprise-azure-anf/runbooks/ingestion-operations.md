<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Ingestion Operations

## Scope

This runbook covers the operational loop for enterprise document ingestion from ANF into PostgreSQL with `pgvector`.

## Operational Sequence

1. detect or schedule document ingestion
2. parse and extract content
3. chunk and embed
4. write chunks and metadata into PostgreSQL
5. validate retrieval visibility for the new content

## Watch Items

- duplicate ingestion
- parse failures on complex documents
- embedding timeouts
- backlog growth between ANF source updates and index availability
- unauthorized ingestion of restricted data classes
