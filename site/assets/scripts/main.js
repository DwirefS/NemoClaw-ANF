// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

document.documentElement.dataset.js = "enabled";

document.documentElement.classList.add("js-enabled");

const yearNode = document.querySelector("[data-current-year]");

if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}
