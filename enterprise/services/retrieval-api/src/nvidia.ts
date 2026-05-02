// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const DEFAULT_EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5";
export const DEFAULT_RERANKING_MODEL = "nvidia/llama-nemotron-rerank-1b-v2";
export const DEFAULT_CHAT_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

export interface NimRequest<TPayload> {
  path: string;
  payload: TPayload;
}

export interface EmbeddingNimPayload {
  input: string[];
  model: string;
  input_type: "query";
  modality: "text";
}

export interface RerankingNimPayload {
  model: string;
  query: {
    text: string;
  };
  passages: Array<{
    text: string;
  }>;
  truncate: "END";
}

export interface ChatCompletionPayload {
  model: string;
  messages: Array<{
    role: "user";
    content: string;
  }>;
  max_tokens: number;
  temperature: number;
}

export function buildEmbeddingNimRequest(
  query: string,
): NimRequest<EmbeddingNimPayload> {
  return {
    path: "/v1/embeddings",
    payload: {
      input: [query],
      model: DEFAULT_EMBEDDING_MODEL,
      input_type: "query",
      modality: "text",
    },
  };
}

export function buildRerankingNimRequest(
  query: string,
  passages: string[],
): NimRequest<RerankingNimPayload> {
  return {
    path: "/v1/ranking",
    payload: {
      model: DEFAULT_RERANKING_MODEL,
      query: { text: query },
      passages: passages.map((text) => ({ text })),
      truncate: "END",
    },
  };
}

export function buildNemotronChatRequest(
  prompt: string,
): NimRequest<ChatCompletionPayload> {
  return {
    path: "/v1/chat/completions",
    payload: {
      model: DEFAULT_CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0,
    },
  };
}
