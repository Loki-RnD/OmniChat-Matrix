/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

// Vite requires a default configuration export.
export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: fileURLToPath(new URL("./src/index.tsx", import.meta.url)),
            name: "omnichat-jade-workspace",
            fileName: "index",
            formats: ["es"],
        },
        minify: false,
    },
    plugins: [react()],
});
