# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# MCP stdio servers are typically exec'd directly by the MCP client (the agent
# runtime), so this image exists for embedding the bridge into agent images
# rather than for running as a standalone network service.
FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY src ./src

CMD ["node", "--experimental-strip-types", "./src/index.ts"]
