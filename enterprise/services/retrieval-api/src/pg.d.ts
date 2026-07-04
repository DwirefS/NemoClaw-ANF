// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// The pg driver ships no type declarations and is only installed inside this
// package, while the repo-root typecheck follows imports into these sources.
// The factory narrows the module to PgPoolModule at the call site.
declare module "pg";
