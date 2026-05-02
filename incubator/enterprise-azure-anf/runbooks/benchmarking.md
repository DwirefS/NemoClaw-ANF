<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Benchmarking

## Measure

- ingestion throughput
- query latency
- retrieval recall
- rerank latency
- grounded answer latency
- model cold-start timing with shared cache
- snapshot and restore timing

## Compare

Always compare:

- baseline without optimization
- optimized path with ANF-backed cache or storage separation
- performance before and after upstream syncs that affect runtime behavior

## Output

Record:

- workload shape
- environment matrix
- volume class
- result summary
- regression threshold
