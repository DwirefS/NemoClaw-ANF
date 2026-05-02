<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Canonical Source Map

This map defines how the incubator resolves conflicting source material from the supplied research set.

## Canonical Reading Order

1. `Sovereign Enterprise AI: A Technical Whitepaper on NVIDIA NemoClaw, Nemotron RAG, and Azure NetApp Files.md`
2. `Definitive Enterprise AI Architecture: NVIDIA NemoClaw + Nemotron RAG on Azure with Azure NetApp Files.md`
3. `research_synthesis.txt`
4. `Enterprise AI Architecture Draft.docx`

Use the first three for target-state architecture. Use the DOCX draft to correct target-state optimism with current upstream runtime constraints.

## Source Families

| Family | Canonical Source | Supporting Sources | How To Use |
|---|---|---|---|
| Long-form target architecture | `Sovereign Enterprise AI...md` | `whitepaper_part2.md`, `whitepaper_part3.md`, `NemoClaw_ANF_Whitepaper_FINAL.pdf` | Use for the broadest end-to-end proposal and deployment narrative. |
| Refined architecture summary | `Definitive Enterprise AI Architecture...md` | `Definitive_NemoClaw_Enterprise_AI_Report.pdf` | Use for concise, decision-oriented architecture framing. |
| Early architecture exploration | `Enterprise AI Architecture...md` | `NemoClaw_Enterprise_AI_Report.pdf`, `Presentation Script...md` | Use for rationale history and topic coverage, not as final authority. |
| Advanced security extensions | `Enriched Enterprise AI Architecture...md` | `NemoClaw_Enterprise_AI_Report_Enriched.pdf`, `Enriched Presentation Script...md` | Use for field/vault isolation, snapshot-as-memory, and NIMCache ideas. |
| Research corpus synthesis | `research_synthesis.txt` | `research_notes.md`, `all_summaries.txt`, `nemoclaw_wide_research.json`, `advanced_nemoclaw_research.json` | Use for source-backed fact extraction and terminology normalization. |
| Reality-check and feasibility correction | `Enterprise AI Architecture Draft.docx` | none | Use when raw architecture documents over-assume AKS-native NemoClaw/OpenShell behavior. |
| Diagram sources | `.mmd` files | `.png` files | Treat Mermaid as source of truth. PNG files are rendered companions only. |

## Contradiction Resolution Rules

- Prefer the DOCX draft when deciding what is supported by the current NemoClaw/OpenShell runtime.
- Prefer the whitepaper and definitive report when deciding the long-range target architecture.
- Prefer explicit repo reality over any external document when a source claims a feature already exists in NemoClaw today.
- Preserve high-value ideas from the enriched and whitepaper sources, but reframe them as custom engineering or future-state work when they exceed current upstream behavior.

## Promotion Rule

No raw corpus file is promoted into `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/docs` directly. Promotion must pass through incubator specs, ADRs, and contributor review first.
