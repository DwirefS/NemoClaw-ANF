<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# NemoMaxxing Console

A dependency-free web console for the Enterprise Azure ANF overlay. It is the human-facing surface of the platform:

- **Grounded Chat** — sends the question through the retrieval API boundary, composes a citation-numbered grounded prompt, and calls an OpenAI-compatible chat endpoint (Nemotron NIM by default; any vLLM or SGLang endpoint works the same way).
- **Retrieval Inspector** — shows exactly what the boundary returned for the last request: grounding mode, filtered and denied collections, and which ACL-restricted chunks were eligible, so role and permission enforcement is visible rather than implied.

The console never talks to PostgreSQL or the ANF document share directly. All knowledge access flows through the retrieval API, preserving the enterprise boundary.

NVIDIA's RAG blueprint ships its own sample frontend; this console exists because the overlay needs the role and ACL controls (field-agent versus vault-agent, principals) that a generic RAG playground does not expose. Swapping in another frontend only requires pointing it at the same retrieval API.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CONSOLE_HOST` / `CONSOLE_PORT` | `0.0.0.0` / `8090` | Listen address |
| `RETRIEVAL_API_URL` | `http://retrieval-api.data-plane.svc.cluster.local:8080` | Retrieval boundary |
| `CHAT_ENDPOINT` | `http://nemotron-llm.inference.svc.cluster.local:8000` | OpenAI-compatible chat server (NIM, vLLM, SGLang) |
| `CHAT_MODEL` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | Model name sent in chat requests |

## Run

```bash
npm start
```

## End-To-End Validation

Requires a bootstrapped `RETRIEVAL_API_DATABASE_URL` (see the retrieval API README):

```bash
npm run e2e:local
```

This seeds a mixed-sensitivity corpus, runs a combined mock NIM (embeddings, ranking, chat), boots the real retrieval API and the console, and asserts grounded chat plus ACL enforcement through the console's HTTP surface.

## HTTP Surface

- `GET /healthz`
- `GET /api/config` — model and retrieval endpoint identity for the UI badge
- `POST /api/query` — forwards `{query, role, collections?, principals?}` to the retrieval API (inspector)
- `POST /api/chat` — retrieval, grounded prompt composition, chat completion; returns `{answer, model, groundingMode, policy, results}`
