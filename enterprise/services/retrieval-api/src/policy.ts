// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { RetrievalPolicySummary, RetrievalRequestBody } from "./contracts.ts";
import { getRetrievalProfile } from "./profiles.ts";

export interface ResolvedRetrievalPolicy {
  filteredCollections: string[];
  deniedCollections: string[];
  maxResults: number;
  groundingMode: "sanitized-only" | "restricted-enterprise";
  principals: string[];
  summary: RetrievalPolicySummary;
}

export function resolveRetrievalPolicy(request: RetrievalRequestBody): ResolvedRetrievalPolicy {
  const profile = getRetrievalProfile(request.role);
  const requestedCollections = request.collections?.length
    ? request.collections
    : profile.allowedCollections;
  const allowedSet = new Set(profile.allowedCollections);
  const filteredCollections = requestedCollections.filter((collection) =>
    allowedSet.has(collection),
  );
  const deniedCollections = requestedCollections.filter(
    (collection) => !allowedSet.has(collection),
  );
  const requestedMax = request.maxResults ?? profile.defaultMaxResults;
  const maxResults = Math.min(Math.max(1, requestedMax), profile.maxResultsLimit);
  // Sanitized-only roles must never carry identity principals into retrieval:
  // they ground exclusively on unrestricted (empty-ACL) chunks.
  const principals =
    profile.groundingMode === "restricted-enterprise" ? (request.principals ?? []) : [];

  return {
    filteredCollections,
    deniedCollections,
    maxResults,
    groundingMode: profile.groundingMode,
    principals,
    summary: {
      directDatabaseAccess: false,
      directDocumentShareAccess: false,
      filteredCollections,
      deniedCollections,
    },
  };
}
