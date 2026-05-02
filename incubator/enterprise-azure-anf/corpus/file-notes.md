<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# File Notes

The table below captures the purpose of each supplied artifact and why it remains in scope for this incubator.

| Source File | Role | Notes |
|---|---|---|
| `Enterprise AI Architecture Draft.docx` | Reality-check source | The clearest correction layer for runtime maturity, AKS assumptions, and the hybrid baseline recommendation. |
| `nemoclaw_wide_research.json` | Research feed | Broad topic sweep across NemoClaw, OpenClaw, Nemotron, NIMs, RAG Blueprint, ANF, AKS, and governance. |
| `research_notes.md` | Research feed | Human-readable summary of the research stream, especially strong on NemoClaw/OpenShell behavior. |
| `all_summaries.txt` | Research feed | Flat aggregate of all topical summaries across the wide research set. |
| `Presentation Script: NVIDIA NemoClaw + Nemotron RAG on Azure with Azure NetApp Files.md` | Presentation derivative | Slide-friendly narrative of the base architecture report. Useful for messaging, not for final authority. |
| `NemoClaw_Enterprise_AI_Report.pdf` | Rendered companion | PDF rendering of the base technical report. Keep for extraction provenance only. |
| `Enterprise AI Architecture: NVIDIA NemoClaw + Nemotron RAG on Azure with Azure NetApp Files.md` | Primary architecture source | First complete proposal of the ANF + RAG + NemoClaw stack. Later superseded in precision. |
| `advanced_nemoclaw_research.json` | Research feed | Focused on multi-agent isolation, snapshot patterns, ANF cloning, and large-model operations. |
| `NemoClaw_Enterprise_AI_Report_Enriched.pdf` | Rendered companion | PDF rendering of the enriched security and operations report. |
| `Enriched Presentation Script: Advanced Sovereign AI with NVIDIA NemoClaw & Azure NetApp Files.md` | Presentation derivative | Communication-oriented version of the enriched report. |
| `Enriched Enterprise AI Architecture: NVIDIA NemoClaw + Nemotron RAG on Azure with Azure NetApp Files.md` | Primary architecture source | Adds field/vault segmentation, snapshot-as-memory, and NIMCache patterns. |
| `research_synthesis.txt` | Primary architecture source | Most useful bridge between raw research facts and architecture claims. |
| `Definitive_NemoClaw_Enterprise_AI_Report.pdf` | Rendered companion | PDF rendering of the definitive report. |
| `Definitive Enterprise AI Architecture: NVIDIA NemoClaw + Nemotron RAG on Azure with Azure NetApp Files.md` | Primary architecture source | Strong concise architecture reference and precursor to the final whitepaper. |
| `whitepaper_part2.md` | Supporting fragment | Mid-document extract from the long whitepaper. Useful when the whitepaper is split for ingestion or review. |
| `whitepaper_part3.md` | Supporting fragment | Final-document extract from the long whitepaper. Useful when the whitepaper is split for ingestion or review. |
| `arch_overview.mmd` | Diagram source | Canonical research diagram of the full-stack architecture. Shows the aspirational AKS-hosted agent placement. |
| `ingestion_flow.mmd` | Diagram source | Canonical research diagram of document ingestion from ANF through NV-Ingest into PostgreSQL with `pgvector`. |
| `rag_flow.mmd` | Diagram source | Canonical research diagram of the end-user query, guardrails, retrieval, rerank, and memory flow. |
| `multiagent_security.mmd` | Diagram source | Canonical research diagram of the field/vault isolation pattern. |
| `anf_roles.mmd` | Diagram source | Canonical research diagram of ANF volume responsibilities and data-management features. |
| `NemoClaw_ANF_Whitepaper_FINAL.pdf` | Rendered companion | PDF rendering of the long whitepaper. |
| `Sovereign Enterprise AI: A Technical Whitepaper on NVIDIA NemoClaw, Nemotron RAG, and Azure NetApp Files.md` | Primary architecture source | Canonical long-form proposal for the incubator target state. |
| `anf_roles.png` | Rendered companion | PNG export of `anf_roles.mmd`. |
| `multiagent_security.png` | Rendered companion | PNG export of `multiagent_security.mmd`. |
| `rag_flow.png` | Rendered companion | PNG export of `rag_flow.mmd`. |
| `ingestion_flow.png` | Rendered companion | PNG export of `ingestion_flow.mmd`. |
| `arch_overview.png` | Rendered companion | PNG export of `arch_overview.mmd`. |

## Practical Guidance

- Use the Markdown documents when a PDF and Markdown version describe the same artifact.
- Use the Mermaid source files when a Mermaid and PNG pair describe the same diagram.
- Use the DOCX draft whenever the other architecture documents sound more productized than the current NemoClaw repo actually is.
