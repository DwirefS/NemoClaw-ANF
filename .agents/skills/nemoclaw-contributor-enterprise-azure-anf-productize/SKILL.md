---
name: nemoclaw-contributor-enterprise-azure-anf-productize
description: Use when deciding whether Enterprise Azure ANF incubator content is ready to move into official docs, generated user skills, or a more permanent product-owned overlay surface.
---

# Enterprise Azure ANF Productize

Start with the promotion and repo-governance docs.

## Read Order

1. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/11-risks-gaps-and-promotion-criteria.md`
2. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/12-repo-strategy-and-upstream-sync.md`
3. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/runbooks/overlay-adoption-plan.md`
4. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/runbooks/upstream-sync-and-overlay-release.md`
5. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/runbooks/upstream-diff-register.md`

## Use This Skill When

- you need to decide whether content stays incubated or becomes official
- you need to classify a change as overlay-only, controlled overlap, or upstream-worthy
- you need to review whether the fork is still maintainable under the current model
- you need release framing for NemoClaw core plus enterprise overlay

## Workflow

- Check promotion criteria first.
- Confirm whether the content depends on unvalidated assumptions or controlled-overlap patches.
- If a change touches upstream-owned paths, review the diff register before deciding how to publish it.
- Prefer contributor-facing incubator assets over official user-facing docs until the baseline is proven.

## Common Mistakes

- Publishing incubator architecture as if it were already a supported upstream deployment path.
- Moving enterprise guidance into generated `nemoclaw-user-*` skills too early.
- Letting controlled-overlap patches accumulate without release tracking.
