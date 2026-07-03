// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Output masking for sanitized-only (low-trust) responses, per the
 * whitepaper's secure-gateway "redaction & masking" duty. Patterns cover
 * common accidental-leak shapes; they are a defense-in-depth layer on top
 * of collection and ACL policy, never a substitute for it.
 */

const REDACTION_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[redacted-email]",
  },
  {
    name: "api-key",
    // Bearer tokens, NGC/HF-style keys, and long opaque secrets.
    pattern: /\b(?:nvapi|hf|sk|ghp|gho)-[A-Za-z0-9_-]{16,}\b/g,
    replacement: "[redacted-key]",
  },
  {
    name: "card-number",
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    replacement: "[redacted-number]",
  },
  {
    name: "phone",
    pattern: /\+\d{1,3}[ -]?\(?\d{1,4}\)?(?:[ -]?\d{2,4}){2,3}/g,
    replacement: "[redacted-phone]",
  },
];

export interface RedactionResult {
  text: string;
  redactions: number;
}

export function redactText(text: string): RedactionResult {
  let redactions = 0;
  let output = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    output = output.replace(pattern, () => {
      redactions += 1;
      return replacement;
    });
  }
  return { text: output, redactions };
}
