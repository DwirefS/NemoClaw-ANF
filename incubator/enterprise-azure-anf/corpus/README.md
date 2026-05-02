<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Corpus Model

This folder normalizes the external research bundle that informed the incubator.

## Files

- `manifest.yaml` is the inventory of every user-supplied source file, including lineage metadata.
- `graph.json` records the main documents, concepts, claims, risks, and decisions, including the four architecture tensions that must stay visible.
- `canonical-source-map.md` defines what contributors should treat as authoritative when the raw corpus disagrees with itself.
- `file-notes.md` is the per-file digest of why each artifact exists and how it should be used.
- `extracted-highlights.md` captures the extracted meaning of the PDFs and DOCX so contributors do not need to reread the raw bundle to understand the current-state constraints.

## How To Use The Corpus

1. Start with the incubator spec docs, not the raw source files.
2. When you need provenance, consult `canonical-source-map.md`.
3. When a source appears to conflict with repo reality, consult `graph.json` and the reality-check notes from the DOCX draft.
4. Preserve explicit lineage. Do not replace superseded sources silently.
