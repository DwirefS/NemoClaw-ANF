# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class IngestConfig:
    documents: list[str]
    parse_endpoint: str
    embedding_endpoint: str
    postgres_dsn: str
    default_collection: str
    default_classification: str


def load_config() -> IngestConfig:
    source_dir = os.environ.get("INGEST_SOURCE_DIR", "/mnt/documents")
    return IngestConfig(
        documents=[source_dir],
        parse_endpoint=os.environ.get(
            "PARSE_ENDPOINT",
            "http://nemo-parse.inference.svc.cluster.local:8000",
        ),
        embedding_endpoint=os.environ.get(
            "EMBEDDING_ENDPOINT",
            "http://nemo-embedder.inference.svc.cluster.local:8000",
        ),
        postgres_dsn=os.environ["POSTGRES_DSN"],
        default_collection=os.environ.get("DEFAULT_COLLECTION", "enterprise-public"),
        default_classification=os.environ.get(
            "DEFAULT_CLASSIFICATION",
            "internal-sanitized",
        ),
    )
