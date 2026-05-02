# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

from typing import Any

from nemo_retriever import create_ingestor

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
