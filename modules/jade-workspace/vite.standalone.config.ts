/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The standalone entry bundles React; the Element module reuses the host's React.
export default defineConfig({
    plugins: [react()],
    server: { host: "127.0.0.1", port: 3005, strictPort: true },
    preview: { host: "127.0.0.1", port: 3005, strictPort: true },
    build: { outDir: "dist", target: "es2022" },
});
