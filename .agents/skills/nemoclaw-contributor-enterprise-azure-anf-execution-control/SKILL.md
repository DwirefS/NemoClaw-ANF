---
name: nemoclaw-contributor-enterprise-azure-anf-execution-control
description: Use when continuing Enterprise Azure ANF implementation work and you need the current logbook, backlog, dependency map, or change-control rules for plan-first execution.
---

# Enterprise Azure ANF Execution Control

Start here before continuing implementation work on the overlay.

## Read Order

1. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/15-engineering-tracker.md`
2. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/16-program-logbook.md`
3. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/17-delivery-backlog-and-dependencies.md`
4. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/18-change-control-and-execution-rules.md`
5. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/12-repo-strategy-and-upstream-sync.md`

## Use This Skill When

- you are continuing build work in the enterprise overlay
- you need to know what was already done
- you need to know what remains next and what depends on what
- you are considering cleanup, removal, or structural edits

## Workflow

- Read the engineering tracker first for current status.
- Read the program logbook for chronology and prior conflicts.
- Read the delivery backlog for dependency-aware next steps.
- Read the execution rules before making structural changes.

## Required Behaviors

- Write or update a plan before substantial execution.
- Do not remove, delete, or destructively replace repo files, package surfaces, manifests, or incubator assets without obtaining explicit user approval first.
- For any such removal or destructive replacement, obtain explicit user approval first.
- After each implementation pass, update the tracker, logbook, and backlog if the work changed project status.
- Record conflicts and resolutions instead of hiding them in a chat-only explanation.

## Common Mistakes

- Implementing new work without updating the backlog or logbook.
- Deleting placeholder work without approval because a better package boundary now exists.
- Treating the engineering tracker as a substitute for the chronological program logbook.
