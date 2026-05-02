<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Enterprise Overlay

This directory contains project-owned runtime code for the Azure NetApp Files enterprise overlay.

Rules:

- Keep enterprise services here instead of upstream NemoClaw core paths whenever possible.
- Treat this surface as additive. If a feature can live here, it should not be patched into `src/`, `nemoclaw/`, or `nemoclaw-blueprint/`.
- Integrate with NemoClaw through stable seams such as internal APIs, environment configuration, deployment overlays, and narrowly scoped adapters.

The first runtime slice is the retrieval API service under `enterprise/services/retrieval-api/`, including:

- policy-aware HTTP retrieval handling
- NVIDIA NIM request contracts for embedding, reranking, and Nemotron chat
- OpenAI-compatible NIM HTTP client adapters
- backend selection between static and live `pgvector` modes
- a pgvector-backed hybrid query executor boundary
- SQL migration assets for the `document_chunks` retrieval store

The first project-owned worker slice is under `enterprise/workers/nemo-retriever-ingest/`, including:

- a NeMo Retriever-based document ingestion worker
- worker-owned PostgreSQL write logic for `document_chunks`
- a Docker image boundary that can be referenced directly from the incubator manifests
