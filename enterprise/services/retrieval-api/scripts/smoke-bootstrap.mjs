#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const checks = [
  {
    name: "RETRIEVAL_API_DATABASE_URL",
    label: "Database URL",
    value: process.env.RETRIEVAL_API_DATABASE_URL,
  },
  {
    name: "RETRIEVAL_API_EMBEDDING_URL",
    label: "Embedding endpoint",
    value: process.env.RETRIEVAL_API_EMBEDDING_URL,
  },
  {
    name: "RETRIEVAL_API_RERANKER_URL",
    label: "Reranker endpoint",
    value: process.env.RETRIEVAL_API_RERANKER_URL,
  },
];

const formatStatus = (value) => (value ? "configured" : "missing");
const summarizeValue = (value) => (value ? value : "<missing>");

console.log("Retrieval bootstrap readiness summary");

for (const check of checks) {
  console.log(`${check.label}: ${formatStatus(check.value)}`);
  console.log(`  ${check.name}: ${summarizeValue(check.value)}`);
}

const missing = checks.filter((check) => !check.value);

if (missing.length > 0) {
  console.error("Bootstrap readiness failed. Missing required environment variables:");
  for (const check of missing) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log("Bootstrap readiness check passed.");
