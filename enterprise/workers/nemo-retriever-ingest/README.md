<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# NeMo Retriever Ingestion Worker

This package is the project-owned ingestion worker for the Enterprise Azure ANF overlay.

Responsibilities:

- read enterprise source documents from the mounted ANF document repository
- invoke the documented NeMo Retriever extraction and embedding flow
- normalize extracted chunks into the `document_chunks` schema shape
- write chunk rows into PostgreSQL with `pgvector`

This worker is intentionally separate from upstream NemoClaw core and separate from the retrieval API runtime.
