// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAllDocuments } from "yaml";
import {
  buildEmbeddingNimRequest,
  buildNemotronChatRequest,
  buildRerankingNimRequest,
} from "../enterprise/services/retrieval-api/src/nvidia";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseYamlDocuments(relativePath: string) {
  return parseAllDocuments(read(relativePath)).map((document) => document.toJS());
}

describe("enterprise NVIDIA alignment", () => {
  it("builds request payloads that match the documented NIM API shapes", () => {
    expect(buildEmbeddingNimRequest("What changed in the last release?")).toEqual({
      path: "/v1/embeddings",
      payload: {
        input: ["What changed in the last release?"],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query",
        modality: "text",
      },
    });

    expect(
      buildRerankingNimRequest("Summarize the forecast variance", [
        "Passage one",
        "Passage two",
      ]),
    ).toEqual({
      path: "/v1/ranking",
      payload: {
        model: "nvidia/llama-nemotron-rerank-1b-v2",
        query: { text: "Summarize the forecast variance" },
        passages: [{ text: "Passage one" }, { text: "Passage two" }],
        truncate: "END",
      },
    });

    expect(buildNemotronChatRequest("Answer using grounded enterprise context.")).toEqual({
      path: "/v1/chat/completions",
      payload: {
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
        messages: [{ role: "user", content: "Answer using grounded enterprise context." }],
        max_tokens: 512,
        temperature: 0,
      },
    });
  });

  it("uses NIM Operator CRDs and documented model names in the NIM deployment manifest", () => {
    const documents = parseYamlDocuments("incubator/enterprise-azure-anf/manifests/nim-services.yaml");
    const items = documents[0].items as Array<Record<string, unknown>>;
    const nimKinds = items.map((item) => `${String(item.apiVersion)}:${String(item.kind)}`);
    const names = items.map((item) => String((item.metadata as { name: string }).name));

    expect(nimKinds).toContain("apps.nvidia.com/v1alpha1:NIMCache");
    expect(nimKinds).toContain("apps.nvidia.com/v1alpha1:NIMService");
    expect(names).toContain("nemotron-llm");
    expect(names).toContain("nemo-embedder");
    expect(names).toContain("nemo-reranker");

    const rendered = JSON.stringify(items);
    expect(rendered).toContain("nvidia/llama-3.1-nemotron-70b-instruct");
    expect(rendered).toContain("nvidia/nv-embedqa-e5-v5");
    expect(rendered).toContain("nvidia/llama-nemotron-rerank-1b-v2");
  });

  it("pins the ingest example to the stable NeMo Retriever release branch and official pipeline shape", () => {
    const manifest = read("incubator/enterprise-azure-anf/manifests/nv-ingest-trigger.yaml");

    expect(manifest).toContain("git+https://github.com/NVIDIA/NeMo-Retriever@release/26.03");
    expect(manifest).toContain("from nemo_retriever import create_ingestor");
    expect(manifest).toContain(".files(documents)");
    expect(manifest).toContain(".extract(");
    expect(manifest).toContain(".embed()");
  });

  it("provides a PostgreSQL storage class aligned to ANF mount guidance", () => {
    const documents = parseYamlDocuments("incubator/enterprise-azure-anf/manifests/storageclasses-anf.yaml");
    const items = documents[0].items as Array<Record<string, unknown>>;
    const postgresClass = items.find(
      (item) => (item.metadata as { name: string }).name === "anf-postgres-rwo",
    ) as Record<string, unknown> | undefined;

    expect(postgresClass).toBeDefined();
    expect(postgresClass?.mountOptions).toEqual(
      expect.arrayContaining(["vers=4.1", "hard", "nconnect=8", "rsize=65536", "wsize=65536"]),
    );
  });
});
