---
name: nemoclaw-contributor-enterprise-azure-anf-architecture
description: Use when answering architecture questions for the Enterprise Azure ANF incubator, especially around the hybrid baseline, trust zones, retrieval boundaries, or ANF storage roles.
---

# Enterprise Azure ANF Architecture

Start with the incubator spec set and ADRs.

## Read Order

1. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/00-executive-summary.md`
2. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/03-current-state-architecture-hybrid.md`
3. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/05-data-plane-rag-and-pgvector.md`
4. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/07-security-trust-zones-and-guardrails.md`
5. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md`
6. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/adrs/README.md`

## Use This Skill When

- you need to explain what runs on AKS versus the worker tier
- you need the supported baseline rather than the aspirational full AKS model
- you need to describe the retrieval API boundary
- you need to explain field-agent versus vault-agent separation

## Workflow

- Answer from the spec docs first.
- Use ADRs when the question is about a locked decision.
- Use the future-state appendix only after stating that it is not the supported baseline.
- Use the corpus only for provenance or to explain why a decision was made.

## Common Mistakes

- Collapsing the hybrid baseline into a full AKS claim.
- Describing `pgvector` as a stock NVIDIA default instead of an explicit product choice.
- Treating field-agent and vault-agent as new top-level runtimes instead of role profiles.
