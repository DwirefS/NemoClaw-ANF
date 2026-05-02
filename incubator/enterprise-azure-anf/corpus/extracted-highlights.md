<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Extracted Highlights

This file captures the meaning extracted from the non-Markdown artifacts and the repeated conclusions that emerged across the raw corpus.

## Extracted From The DOCX Draft

- The DOCX draft is the strongest corrective to over-optimistic AKS-native NemoClaw/OpenShell assumptions.
- It explicitly recommends a hybrid deployment baseline: AKS for the RAG and inference plane, isolated Azure Linux VMs or worker tier for NemoClaw/OpenShell.
- It treats `pgvector` as viable but custom relative to more stock NVIDIA vector-store paths.
- It emphasizes that the current NemoClaw/OpenShell runtime is still closer to host-side onboarding plus sandbox orchestration than to a turnkey AKS control plane.

## Extracted From The PDFs

- The base report PDF mirrors the first broad architecture proposal and is valuable mostly as provenance for the early end-to-end narrative.
- The enriched report PDF concentrates on three advanced patterns:
  - field-agent versus vault-agent isolation,
  - snapshot-as-memory using ANF snapshots and clones,
  - ANF-backed `NIMCache` for large-model cold-start reduction.
- The definitive report PDF compresses the architecture into a shorter validation narrative and is the clearest report-form precursor to the final whitepaper.
- The whitepaper PDF is the most complete long-form treatment of the stack and aligns closely with the long whitepaper Markdown source.

## Repeated High-Value Conclusions

### Validated current-state behavior

- NemoClaw is a secured reference stack on top of OpenClaw and OpenShell, not a full replacement for the underlying runtime.
- OpenShell remains the key security boundary for sandboxing, egress mediation, and credential handling.
- The current repo and research material support a conservative interpretation: the agent runtime is better treated as a separate worker tier than as a fully AKS-native control plane.

### Target architecture

- ANF is the shared persistence substrate for documents, model cache, selected state, and database storage.
- AKS is the right home for the RAG and inference plane: ingestion, OCR or parsing, embedding, reranking, LLM NIMs, guardrails, retrieval API, and PostgreSQL with `pgvector`.
- A segmented field-agent and vault-agent model is a strong pattern for multi-agent enterprise deployments.

### Custom engineering required

- The `pgvector` retrieval path requires explicit ownership and benchmarking against NVIDIA's stock RAG integrations.
- ACL-aware retrieval and identity-bound result filtering are critical but not solved by the raw corpus.
- Agent memory on ANF is a design pattern, not a drop-in supported feature of current NemoClaw behavior.
- A full AKS-hosted NemoClaw/OpenShell runtime remains experimental until the upstream product and operator story mature.
