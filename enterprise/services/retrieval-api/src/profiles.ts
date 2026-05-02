// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AgentRole, GroundingMode } from "./contracts";

export interface RetrievalProfile {
  role: AgentRole;
  groundingMode: GroundingMode;
  allowedCollections: string[];
  defaultMaxResults: number;
  maxResultsLimit: number;
}

const profiles: Record<AgentRole, RetrievalProfile> = {
  "field-agent": {
    role: "field-agent",
    groundingMode: "sanitized-only",
    allowedCollections: ["enterprise-public", "enterprise-internal-sanitized"],
    defaultMaxResults: 8,
    maxResultsLimit: 12,
  },
  "vault-agent": {
    role: "vault-agent",
    groundingMode: "restricted-enterprise",
    allowedCollections: [
      "enterprise-public",
      "enterprise-internal-sanitized",
      "enterprise-sensitive",
      "enterprise-regulated",
    ],
    defaultMaxResults: 10,
    maxResultsLimit: 20,
  },
};

export function getRetrievalProfile(role: AgentRole): RetrievalProfile {
  return profiles[role];
}
