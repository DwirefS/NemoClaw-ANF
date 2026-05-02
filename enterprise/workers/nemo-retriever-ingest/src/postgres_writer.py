# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import json
import uuid
from typing import Any, Iterable

import psycopg


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

    return (
        str(chunk.get("id", uuid.uuid4())),
        source_id,
        title,
        collection,
        classification,
        content,
        json.dumps(metadata),
        embedding,
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
                  embedding
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (id) DO UPDATE SET
                  source_id = EXCLUDED.source_id,
                  title = EXCLUDED.title,
                  collection = EXCLUDED.collection,
                  classification = EXCLUDED.classification,
                  content = EXCLUDED.content,
                  metadata = EXCLUDED.metadata,
                  embedding = EXCLUDED.embedding
                """,
                rows,
            )
        connection.commit()
