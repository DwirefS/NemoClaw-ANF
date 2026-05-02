# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

FROM node:24-bookworm-slim

WORKDIR /app

COPY enterprise/services/retrieval-api /app

ENV NODE_ENV=production
ENV RETRIEVAL_API_HOST=0.0.0.0
ENV RETRIEVAL_API_PORT=8080
ENV RETRIEVAL_API_PROFILE_MODE=hybrid
ENV RETRIEVAL_API_SERVICE_NAME=retrieval-api

CMD ["node", "--experimental-strip-types", "--enable-source-maps", "./src/index.ts"]
