-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
-- SPDX-License-Identifier: Apache-2.0

-- Agent memory tiers: semantic rows carry embeddings for similarity recall,
-- episodic rows are chronological facts recalled by text or recency. State
-- memory (full workspace rollback) lives on ANF snapshots, not in SQL.
-- agent_id is the gateway-verified subject; this service trusts it only
-- because the NetworkPolicy makes the gateway its sole caller.
CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('episodic', 'semantic')),
  content TEXT NOT NULL,
  -- Dimension is coupled to DEFAULT_EMBEDDING_MODEL (1024); episodic rows
  -- store NULL and are recalled by full-text rank and recency only.
  embedding vector(1024) NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_memory_agent_recency_idx
  ON agent_memory (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_memory_tsv_gin_idx
  ON agent_memory
  USING GIN (tsv);

CREATE INDEX IF NOT EXISTS agent_memory_embedding_hnsw_idx
  ON agent_memory
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
