/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: { environment: "node", include: ["src/**/*.test.ts"], globals: false },
});
