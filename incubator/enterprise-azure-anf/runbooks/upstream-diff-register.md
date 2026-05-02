<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Upstream Diff Register

Use this register for any change made in an upstream-owned NemoClaw path.

If a local enterprise feature can be implemented without touching upstream-owned files, do that instead and leave this file unchanged.

## Current State

No intentional upstream-owned file patches have been registered yet.

## Entry Template

Copy this template when the first controlled-overlap patch becomes necessary.

```markdown
## Patch ID: YYYYMMDD-<short-name>

- **Status:** proposed | active | removed | upstreamed
- **Files:** `/absolute/or/repo/path`
- **Reason:** Why the overlay could not stay outside the upstream-owned path
- **Business Need:** What enterprise requirement forced the patch
- **Conflict Risk:** low | medium | high
- **Tests:** Exact tests or validation commands that cover the patch
- **Upstream Fate:** keep-local | propose-upstream | waiting-for-upstream
- **Removal Trigger:** What change would let us delete this patch later
- **Notes:** Any sync caveats, merge pain, or release implications
```

## Review Rule

Review this register on every upstream merge and every integrated platform release.
