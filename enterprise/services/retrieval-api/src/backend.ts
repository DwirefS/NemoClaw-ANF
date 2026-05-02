// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AgentRole, RetrievalResult } from "./contracts";

export interface BackendSearchRequest {
  query: string;
  role: AgentRole;
  collections: string[];
  maxResults: number;
}

export interface RetrievalBackend {
  health(): Promise<{ ok: true }>;
  search(request: BackendSearchRequest): Promise<RetrievalResult[]>;
}

export function createStaticBackend(seedResults: RetrievalResult[]): RetrievalBackend {
  return {
    async health() {
      return { ok: true };
    },
    async search(request) {
      const allowedCollections = new Set(request.collections);
      return seedResults
        .filter((result) => allowedCollections.has(result.collection))
        .slice(0, request.maxResults);
    },
  };
}
