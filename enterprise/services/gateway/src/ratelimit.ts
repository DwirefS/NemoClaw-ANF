// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/** Token bucket per subject: capacity = perMinute, refill over one minute. */

export interface RateLimiter {
  allow(subject: string): boolean;
}

export function createRateLimiter(
  perMinute: number,
  now: () => number = () => Date.now(),
): RateLimiter {
  if (perMinute <= 0) {
    return { allow: () => true };
  }
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();
  const refillPerMs = perMinute / 60_000;

  return {
    allow(subject: string) {
      const timestamp = now();
      const bucket = buckets.get(subject) ?? { tokens: perMinute, updatedAt: timestamp };
      bucket.tokens = Math.min(
        perMinute,
        bucket.tokens + (timestamp - bucket.updatedAt) * refillPerMs,
      );
      bucket.updatedAt = timestamp;
      if (bucket.tokens < 1) {
        buckets.set(subject, bucket);
        return false;
      }
      bucket.tokens -= 1;
      buckets.set(subject, bucket);
      return true;
    },
  };
}
