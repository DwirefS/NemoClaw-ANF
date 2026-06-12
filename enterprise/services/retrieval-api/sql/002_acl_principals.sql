-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
-- SPDX-License-Identifier: Apache-2.0

-- ACL principal capture for permission-aware retrieval.
-- An empty array means the chunk is unrestricted (sanitized/public corpus).
-- A non-empty array means at least one of the listed principals must be
-- present on the request for the chunk to be eligible for grounding.
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS acl_principals TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS document_chunks_acl_principals_gin_idx
  ON document_chunks
  USING GIN (acl_principals);
