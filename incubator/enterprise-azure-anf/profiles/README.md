<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Role Profiles

These profiles define enterprise runtime roles without creating new top-level agent runtimes inside NemoClaw itself.

- `field-agent.yaml` describes the lower-trust role used for public research and user-facing interactions.
- `vault-agent.yaml` describes the higher-trust role used for sensitive enterprise reasoning.
- `shared-policy-contract.yaml` defines the bridge and policy controls shared between those roles.

Use these profiles as design inputs for deployment, policy, and review. They are examples, not runtime-enforced schemas by themselves.
