---
name: nemoclaw-contributor-enterprise-azure-anf-deployment
description: Use when assembling or reviewing the Enterprise Azure ANF deployment assets, including ANF storage classes, PostgreSQL, NIM services, retrieval API wiring, and worker-tier bootstrap.
---

# Enterprise Azure ANF Deployment

Start with the deployment specs and incubator manifests.

## Read Order

1. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/09-deployment-workstreams.md`
2. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md`
3. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/manifests/README.md`
4. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/manifests/`
5. `/Users/dwirefs/Documents/VibeProjects/NemoClaw-ANF/incubator/enterprise-azure-anf/profiles/`

## Use This Skill When

- you need to understand the example Kubernetes and bootstrap assets
- you need to review storage-class to workload mapping
- you need to trace how retrieval, guardrails, and NIM services connect
- you need to explain how the worker tier reaches the RAG plane

## Workflow

- Start from workload boundaries in the specs.
- Read the manifest README before any individual manifest.
- Use the role profiles to understand trust-zone assumptions behind the manifests.
- Treat all manifests as incubator examples unless the repo later promotes them into an official deployment surface.

## Common Mistakes

- Mounting the raw ANF document share directly into the agent runtime by default.
- Letting the agent talk directly to PostgreSQL instead of the retrieval API.
- Assuming the worker-tier bootstrap file is an upstream NemoClaw runtime feature.
