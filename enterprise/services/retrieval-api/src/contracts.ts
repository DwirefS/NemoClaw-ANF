// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export type AgentRole = "field-agent" | "vault-agent";

export type GroundingMode = "sanitized-only" | "restricted-enterprise";

export interface RetrievalRequestBody {
  query: string;
  role: AgentRole;
  collections?: string[];
  maxResults?: number;
}

export interface RetrievalResult {
  id: string;
  content: string;
  sourceId: string;
  title: string;
  collection: string;
  classification: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RetrievalPolicySummary {
  directDatabaseAccess: false;
  directDocumentShareAccess: false;
  filteredCollections: string[];
  deniedCollections: string[];
}

export interface RetrievalResponseBody {
  queryId: string;
  role: AgentRole;
  groundingMode: GroundingMode;
  policy: RetrievalPolicySummary;
  results: RetrievalResult[];
}

export interface ErrorResponseBody {
  error: "invalid_request" | "forbidden";
  message: string;
}
