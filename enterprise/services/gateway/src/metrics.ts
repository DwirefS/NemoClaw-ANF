// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/** Minimal Prometheus text-format metrics; no external dependencies. */

const LATENCY_BUCKETS_MS = [25, 50, 100, 250, 500, 1000, 2500, 5000];

export interface GatewayMetrics {
  recordRequest(role: string, status: number, latencyMs: number): void;
  recordDenied(reason: string): void;
  recordRedactions(count: number): void;
  render(): string;
}

export function createMetrics(): GatewayMetrics {
  const requestCounts = new Map<string, number>();
  const deniedCounts = new Map<string, number>();
  let redactionsTotal = 0;
  const latencyBucketCounts = new Array<number>(LATENCY_BUCKETS_MS.length + 1).fill(0);
  let latencySumMs = 0;
  let latencyCount = 0;

  function bump(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return {
    recordRequest(role, status, latencyMs) {
      bump(requestCounts, `role="${role}",status="${status}"`);
      latencySumMs += latencyMs;
      latencyCount += 1;
      const bucketIndex = LATENCY_BUCKETS_MS.findIndex((bound) => latencyMs <= bound);
      latencyBucketCounts[bucketIndex === -1 ? LATENCY_BUCKETS_MS.length : bucketIndex] += 1;
    },
    recordDenied(reason) {
      bump(deniedCounts, `reason="${reason}"`);
    },
    recordRedactions(count) {
      redactionsTotal += count;
    },
    render() {
      const lines: string[] = [
        "# HELP gateway_requests_total Requests handled by the retrieval gateway.",
        "# TYPE gateway_requests_total counter",
      ];
      for (const [labels, count] of requestCounts) {
        lines.push(`gateway_requests_total{${labels}} ${count}`);
      }
      lines.push(
        "# HELP gateway_denied_total Requests denied by authentication or policy.",
        "# TYPE gateway_denied_total counter",
      );
      for (const [labels, count] of deniedCounts) {
        lines.push(`gateway_denied_total{${labels}} ${count}`);
      }
      lines.push(
        "# HELP gateway_redactions_total Redacted spans in sanitized responses.",
        "# TYPE gateway_redactions_total counter",
        `gateway_redactions_total ${redactionsTotal}`,
        "# HELP gateway_request_duration_ms Request latency in milliseconds.",
        "# TYPE gateway_request_duration_ms histogram",
      );
      let cumulative = 0;
      LATENCY_BUCKETS_MS.forEach((bound, index) => {
        cumulative += latencyBucketCounts[index] ?? 0;
        lines.push(`gateway_request_duration_ms_bucket{le="${bound}"} ${cumulative}`);
      });
      cumulative += latencyBucketCounts[LATENCY_BUCKETS_MS.length] ?? 0;
      lines.push(
        `gateway_request_duration_ms_bucket{le="+Inf"} ${cumulative}`,
        `gateway_request_duration_ms_sum ${latencySumMs}`,
        `gateway_request_duration_ms_count ${latencyCount}`,
      );
      return `${lines.join("\n")}\n`;
    },
  };
}
