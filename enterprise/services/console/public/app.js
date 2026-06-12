// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const policyBox = document.getElementById("policy-box");
const resultsBox = document.getElementById("results-box");
const modelBadge = document.getElementById("model-badge");

function csv(id) {
  return document
    .getElementById(id)
    .value.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requestBody(query) {
  const body = { query, role: document.getElementById("role").value };
  const principals = csv("principals");
  const collections = csv("collections");
  if (principals.length > 0) {
    body.principals = principals;
  }
  if (collections.length > 0) {
    body.collections = collections;
  }
  return body;
}

function addMessage(kind, text, meta) {
  const node = document.createElement("div");
  node.className = `msg ${kind}`;
  node.textContent = text;
  if (meta) {
    const metaNode = document.createElement("span");
    metaNode.className = "meta";
    metaNode.textContent = meta;
    node.appendChild(metaNode);
  }
  chatLog.appendChild(node);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderInspector(payload) {
  const policy = payload.policy ?? {};
  policyBox.textContent = JSON.stringify(
    {
      groundingMode: payload.groundingMode,
      filteredCollections: policy.filteredCollections,
      deniedCollections: policy.deniedCollections,
      directDatabaseAccess: policy.directDatabaseAccess,
      directDocumentShareAccess: policy.directDocumentShareAccess,
    },
    null,
    2,
  );

  resultsBox.replaceChildren();
  for (const result of payload.results ?? []) {
    const node = document.createElement("div");
    const restricted = !["public", "internal-sanitized"].includes(result.classification);
    node.className = `result${restricted ? " restricted" : ""}`;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = result.title;

    const badges = document.createElement("div");
    badges.className = "badges";
    for (const label of [
      result.collection,
      result.classification,
      `score ${Number(result.score).toFixed(4)}`,
    ]) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = label;
      badges.appendChild(badge);
    }

    const content = document.createElement("div");
    content.textContent = result.content;

    node.append(title, badges, content);
    resultsBox.appendChild(node);
  }
  if ((payload.results ?? []).length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No chunks were eligible for this role and principal set.";
    resultsBox.appendChild(empty);
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = chatInput.value.trim();
  if (!query) {
    return;
  }
  chatInput.value = "";
  addMessage("user", query);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody(query)),
    });
    const payload = await response.json();
    if (!response.ok) {
      addMessage("error", `${payload.error}: ${payload.message ?? "request failed"}`);
      renderInspector(payload);
      return;
    }
    addMessage(
      "assistant",
      payload.answer,
      `${payload.model} · ${payload.groundingMode} · ${payload.results.length} passages`,
    );
    renderInspector(payload);
  } catch (error) {
    addMessage("error", String(error));
  }
});

fetch("/api/config")
  .then((response) => response.json())
  .then((config) => {
    modelBadge.textContent = `model: ${config.chatModel}`;
  })
  .catch(() => {
    modelBadge.textContent = "model: unavailable";
  });
