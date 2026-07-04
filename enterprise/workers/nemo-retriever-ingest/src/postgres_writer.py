# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import hashlib
import json
from typing import Any, Iterable

import psycopg


def _deterministic_chunk_id(source_id: str, content: str) -> str:
    """Content-addressed chunk id so re-ingesting the same source content
    upserts in place instead of accumulating duplicate rows."""
    digest = hashlib.sha256(f"{source_id}\x00{content}".encode("utf-8")).hexdigest()
    return f"chunk-{digest[:32]}"


def _coerce_principals(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, (str, int)) and str(item).strip()]


def _coerce_chunk(chunk: dict[str, Any], *, default_collection: str, default_classification: str) -> tuple[Any, ...]:
    metadata = dict(chunk.get("metadata", {}))
    source_id = str(metadata.get("source_id", chunk.get("source_id", "unknown-source")))
    title = str(metadata.get("title", chunk.get("title", source_id)))
    collection = str(metadata.get("collection", default_collection))
    classification = str(
        metadata.get("classification", default_classification)
    )
    content = str(chunk.get("text", chunk.get("content", "")))
    embedding = chunk.get("embedding", [])
    acl_principals = _coerce_principals(metadata.get("acl_principals", chunk.get("acl_principals")))

    chunk_id = chunk.get("id") or _deterministic_chunk_id(source_id, content)

    return (
        str(chunk_id),
        source_id,
        title,
        collection,
        classification,
        content,
        json.dumps(metadata),
        # pgvector expects the "[...]" literal form; psycopg would otherwise
        # adapt a Python list as a PostgreSQL array ("{...}") and fail.
        json.dumps(list(embedding)),
        acl_principals,
    )


def write_chunks_to_postgres(
    postgres_dsn: str,
    chunks: Iterable[dict[str, Any]],
    *,
    default_collection: str,
    default_classification: str,
) -> None:
    rows = [
        _coerce_chunk(
            chunk,
            default_collection=default_collection,
            default_classification=default_classification,
        )
        for chunk in chunks
    ]
    if not rows:
        return

    with psycopg.connect(postgres_dsn) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO document_chunks (
                  id,
                  source_id,
                  title,
                  collection,
                  classification,
                  content,
                  metadata,
                  embedding,
                  acl_principals
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::vector, %s)
                ON CONFLICT (id) DO UPDATE SET
                  source_id = EXCLUDED.source_id,
                  title = EXCLUDED.title,
                  collection = EXCLUDED.collection,
                  classification = EXCLUDED.classification,
                  content = EXCLUDED.content,
                  metadata = EXCLUDED.metadata,
                  embedding = EXCLUDED.embedding,
                  acl_principals = EXCLUDED.acl_principals
                """,
                rows,
            )
        connection.commit()
