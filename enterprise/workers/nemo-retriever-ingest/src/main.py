# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import os
import sys
from typing import Any

from nemo_retriever import create_ingestor

from acl_capture import capture_acl_principals
from config import load_config
from postgres_writer import write_chunks_to_postgres


def normalize_chunks(result: Any) -> list[dict[str, Any]]:
    if isinstance(result, list):
        return [chunk for chunk in result if isinstance(chunk, dict)]
    if isinstance(result, dict):
        if isinstance(result.get("chunks"), list):
            return [chunk for chunk in result["chunks"] if isinstance(chunk, dict)]
        return [result]
    return []


def _resolve_source_path(
    metadata: dict[str, Any],
    chunk: dict[str, Any],
    document_roots: list[str],
) -> str | None:
    """Resolve a chunk's source reference to a real file under the document roots."""
    candidates: list[str] = []
    for key in ("source_path", "source_id"):
        value = metadata.get(key, chunk.get(key))
        if isinstance(value, str) and value:
            candidates.append(value)
    for candidate in candidates:
        for root in document_roots:
            root_path = os.path.realpath(root)
            if os.path.isabs(candidate):
                resolved = os.path.realpath(candidate)
            else:
                resolved = os.path.realpath(os.path.join(root_path, candidate))
            if resolved == root_path or resolved.startswith(root_path + os.sep):
                if os.path.isfile(resolved):
                    return resolved
    return None


def augment_chunks_with_captured_acls(
    chunks: list[dict[str, Any]],
    document_roots: list[str],
) -> None:
    """Fill in acl_principals from filesystem permissions when metadata lacks them.

    Best-effort by design: any capture failure logs to stderr and leaves the
    chunk's metadata untouched so ACL capture can never break ingestion.
    """
    for chunk in chunks:
        try:
            metadata = chunk.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}
            if "acl_principals" in metadata:
                continue
            source_path = _resolve_source_path(metadata, chunk, document_roots)
            if source_path is None:
                continue
            metadata["acl_principals"] = capture_acl_principals(source_path)
            chunk["metadata"] = metadata
        except Exception as error:  # noqa: BLE001 - capture must never break ingestion
            print(
                f"acl-capture: skipped ACL capture for chunk: {error}",
                file=sys.stderr,
            )


def main() -> None:
    config = load_config()
    ingestor = (
        create_ingestor()
        .files(config.documents)
        .extract(
            endpoint=config.parse_endpoint,
        )
        .embed()
    )
    result = ingestor.run()
    chunks = normalize_chunks(result)
    write_chunks_to_postgres(
        config.postgres_dsn,
        chunks,
        default_collection=config.default_collection,
        default_classification=config.default_classification,
    )


if __name__ == "__main__":
    main()
