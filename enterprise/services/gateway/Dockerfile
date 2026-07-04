# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY src ./src

ENV GATEWAY_PORT=8095

EXPOSE 8095

CMD ["node", "--experimental-strip-types", "./src/index.ts"]
