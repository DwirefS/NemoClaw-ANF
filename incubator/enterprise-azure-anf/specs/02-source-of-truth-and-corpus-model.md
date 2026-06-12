<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Source Of Truth And Corpus Model

This spec defines what counts as authoritative for the Enterprise Azure ANF program and how the supplied research corpus is normalized, ranked, and contradicted.

## Corpus Surfaces

The corpus model lives under `incubator/enterprise-azure-anf/corpus/`:

| File | Role |
|---|---|
| `manifest.yaml` | Inventory of every user-supplied source file with lineage metadata (25+ records) |
| `graph.json` | Documents, components, concepts, claims, risks, and decisions, including the contradiction edges that must stay visible |
| `canonical-source-map.md` | Resolution rules when raw sources disagree |
| `file-notes.md` | Per-file digest of why each artifact exists |
| `extracted-highlights.md` | Extracted meaning of the PDFs and DOCX so contributors do not reread the raw bundle |

## Source Families

| Family | Canonical Source | How To Use |
|---|---|---|
| Long-form target architecture | Sovereign Enterprise AI whitepaper (md) | Broadest end-to-end proposal and deployment narrative |
| Refined architecture summary | Definitive Enterprise AI Architecture (md) | Concise, decision-oriented framing |
| Early architecture exploration | Enterprise AI Architecture (md) | Rationale history, not final authority |
| Advanced security extensions | Enriched Enterprise AI Architecture (md) | Field/vault isolation, snapshot-as-memory, NIMCache ideas |
| Research corpus synthesis | `research_synthesis.txt` | Source-backed fact extraction and terminology |
| Reality-check correction | Enterprise AI Architecture Draft (docx) | Corrects target-state optimism with current runtime constraints |
| Diagram sources | `.mmd` files | Mermaid is the source of truth; PNGs are rendered companions (ADR-006) |

## Contradiction Model

`graph.json` records four architecture tensions as `contradicts` edges between claims:

| Claim | Contradicted By | Resolution |
|---|---|---|
| `claim-pgvector-target` | `claim-stock-vdb-path` | ADR-003 locks `pgvector` as a deliberate product choice; the overlay owns the integration work |
| `claim-full-aks-runtime` | `claim-hybrid-runtime` | ADR-002 locks the hybrid baseline; full AKS stays a non-baseline appendix |
| `claim-aks-native-secrets` | `claim-gateway-managed-secrets` | Unresolved; tracked as `blocked` Azure-native secret alignment |
| `claim-anf-agent-memory` | `claim-current-agent-state` | Treated as an `assumed` overlay pattern, not an upstream feature |

## Resolution Rules

1. Prefer the DOCX draft when deciding what the current NemoClaw/OpenShell runtime supports.
2. Prefer the whitepaper and definitive report for long-range target architecture.
3. Prefer explicit repo reality over any external document that claims a feature already exists in NemoClaw today.
4. Preserve high-value enriched ideas, but reframe them as custom engineering or future-state work when they exceed upstream behavior.

## Authority Ladder Inside The Repo

When repo surfaces disagree, authority flows in this order:

1. Repo code and tests (`enterprise/`, `test/enterprise-*.test.ts`).
2. ADRs in `incubator/enterprise-azure-anf/adrs/`.
3. The engineering tracker, logbook, and backlog (specs 15-17).
4. Incubator specs and runbooks.
5. The corpus derivatives.
6. The raw research bundle (not committed to this repository).

## Provenance Limitation

The raw corpus source files (the whitepaper Markdown, DOCX draft, research JSON feeds, and rendered PDFs) were captured from the original author's machine and are **not committed to this repository**. Only the normalized derivatives under `corpus/` are in-repo. Claims that trace solely to raw sources should be treated as `assumed` until re-evidenced.

## Promotion Rule

No raw corpus file is promoted into `docs/` directly. Promotion must pass through incubator specs, ADRs, and contributor review first, then the gate in `incubator/enterprise-azure-anf/runbooks/promotion-to-official-docs.md`.

## Provenance

Reconstructed in-repo on 2026-06-12 from the incubator corpus derivatives, ADRs, profiles, manifests, runbooks, diagrams, the published site, and the engineering control surfaces (specs 15-17), because the original spec files were never committed to this repository.
