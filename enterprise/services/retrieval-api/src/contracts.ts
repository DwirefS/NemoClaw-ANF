// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export type AgentRole = "field-agent" | "vault-agent";

export type GroundingMode = "sanitized-only" | "restricted-enterprise";

export interface RetrievalRequestBody {
  query: string;
  role: AgentRole;
  collections?: string[];
  maxResults?: number;
  /**
   * Identity principals (user, group, or service identifiers) attached to the
   * calling agent's session. Chunks with a non-empty ACL are only eligible
   * when at least one chunk principal matches a request principal.
   * Field-agent requests are always treated as having no principals, so they
   * can only ground on unrestricted (empty-ACL) chunks.
   */
  principals?: string[];
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
