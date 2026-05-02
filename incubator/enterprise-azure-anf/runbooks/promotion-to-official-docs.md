<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Promotion To Official Docs

## Promotion Gate

Do not move incubator content into official docs or generated `nemoclaw-user-*` skills unless:

- the supported baseline is validated
- the guidance is no longer speculative
- controlled-overlap patches are understood
- the release model names the upstream base clearly

## Promotion Sequence

1. confirm the content is stable
2. confirm it belongs in user-facing docs rather than contributor-only material
3. update official docs
4. run the docs-to-skills dry run
5. keep generated user skills out of normal incubator PRs unless explicitly promoting
