// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface RetrievalResult {
  id: string;
  content: string;
  sourceId: string;
  title: string;
  collection: string;
  classification: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface GroundedChatRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}

const SYSTEM_PROMPT = [
  "You are an enterprise assistant. Answer ONLY from the numbered context",
  "passages provided. Cite passages as [n]. If the context does not contain",
  "the answer, say so plainly instead of guessing. Never reveal content the",
  "context does not include.",
].join(" ");

export function composeGroundedPrompt(query: string, results: RetrievalResult[]): ChatMessage[] {
  const context = results
    .map(
      (result, index) =>
        `[${index + 1}] (${result.title} — ${result.classification})\n${result.content}`,
    )
    .join("\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Context passages:\n\n${context || "(no passages were retrieved)"}\n\nQuestion: ${query}`,
    },
  ];
}

export function buildGroundedChatRequest(
  model: string,
  query: string,
  results: RetrievalResult[],
): GroundedChatRequest {
  return {
    model,
    messages: composeGroundedPrompt(query, results),
    max_tokens: 1024,
    temperature: 0,
  };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function extractAnswer(body: unknown): string {
  const response = body as ChatCompletionResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Chat endpoint response did not include an answer.");
  }
  return content;
}

/**
 * Extracts the passage numbers the model actually cited ([n] markers) and
 * maps them to result ids, so the UI can distinguish passages that support
 * the answer from passages that were merely retrieved. Numbers outside the
 * result range are ignored.
 */
export function extractCitedPassages(
  answer: string,
  results: RetrievalResult[],
): { indexes: number[]; ids: string[] } {
  const indexes = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,3})\]/g)) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 1 && index <= results.length) {
      indexes.add(index);
    }
  }
  const sorted = [...indexes].sort((left, right) => left - right);
  return {
    indexes: sorted,
    ids: sorted
      .map((index) => results[index - 1]?.id)
      .filter((id): id is string => typeof id === "string"),
  };
}
