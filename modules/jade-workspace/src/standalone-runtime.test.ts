/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { getStandaloneRuntime, type StandaloneRuntimeCache } from "./standalone-runtime";
import { DemoJadeAdapter, DisconnectedJadeAdapter } from "./adapter";

describe("standalone hot-reload lifetime", () => {
    it("reuses the same React root and adapters across module evaluations", () => {
        const cache: StandaloneRuntimeCache = {};
        const createRoot = vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() }));
        const createAdapters = vi.fn(() => ({
            demo: new DemoJadeAdapter(),
            disconnected: new DisconnectedJadeAdapter(),
        }));
        const first = getStandaloneRuntime(cache, createRoot, createAdapters);
        const second = getStandaloneRuntime(cache, createRoot, createAdapters);
        expect(second.root).toBe(first.root);
        expect(second.adapters).toBe(first.adapters);
        expect(createRoot).toHaveBeenCalledTimes(1);
        expect(createAdapters).toHaveBeenCalledTimes(1);
        expect(first.root.unmount).not.toHaveBeenCalled();
    });

    it("creates a fresh root for a different document lifetime", () => {
        const createRoot = vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() }));
        const createAdapters = () => ({
            demo: new DemoJadeAdapter(),
            disconnected: new DisconnectedJadeAdapter(),
        });
        const first = getStandaloneRuntime({}, createRoot, createAdapters);
        const second = getStandaloneRuntime({}, createRoot, createAdapters);
        expect(second.root).not.toBe(first.root);
        expect(createRoot).toHaveBeenCalledTimes(2);
    });
});
