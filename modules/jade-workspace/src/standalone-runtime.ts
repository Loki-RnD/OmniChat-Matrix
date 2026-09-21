/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { Root } from "react-dom/client";
import type { JadeAdapter } from "./contracts";

interface StandaloneRuntime {
    root: Root;
    adapters: { demo: JadeAdapter; disconnected: JadeAdapter };
}

/** Stored in Vite's persistent hot data for the lifetime of the current document. */
export interface StandaloneRuntimeCache {
    runtime?: StandaloneRuntime;
}

/** Reuse the React root and active tasks when Vite reevaluates the entry module. */
export function getStandaloneRuntime(
    cache: StandaloneRuntimeCache,
    createRoot: () => Root,
    createAdapters: () => StandaloneRuntime["adapters"],
): StandaloneRuntime {
    if (!cache.runtime) cache.runtime = { root: createRoot(), adapters: createAdapters() };
    return cache.runtime;
}
