/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "test-utils-rtl";

import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { ComposerApi } from "../../../../../modules/ComposerApi";
import { useWysiwygSendActionHandler } from "./useWysiwygSendActionHandler";
import { setSelection } from "../utils/selection";

vi.mock("../../../../../contexts/ScopedRoomContext.tsx", () => ({
    useScopedRoomContext: () => ({ timelineRenderingType: "Room" }),
}));
vi.mock("../utils/selection", () => ({ setSelection: vi.fn() }));

describe("guarded WYSIWYG insertion", () => {
    const api = new ComposerApi(defaultDispatcher);

    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(setSelection).mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    function setup() {
        const element = { current: document.createElement("div") };
        const functions = { clear: vi.fn(), insertText: vi.fn() };
        const hook = renderHook(({ disabled }) => useWysiwygSendActionHandler(disabled, element, functions), {
            initialProps: { disabled: false },
        });
        return { ...hook, element, functions };
    }

    function deferSelection(): () => void {
        let resolve!: () => void;
        vi.mocked(setSelection).mockReturnValue(
            new Promise<void>((done) => {
                resolve = done;
            }),
        );
        return () => {
            resolve();
        };
    }

    function dispatch(canInsert?: () => boolean): void {
        api.insertPlaintextIntoComposer("Guarded report", { view: "room" }, canInsert);
        act(() => {
            vi.runOnlyPendingTimers();
        });
    }

    it("preserves insertion for existing callers without a guard", async () => {
        const { functions } = setup();
        await act(async () => {
            dispatch();
        });
        expect(functions.insertText).toHaveBeenCalledWith("Guarded report");
    });

    it("rechecks the destination after the real asynchronous dispatcher gap", async () => {
        const { functions } = setup();
        let valid = true;
        const guard = vi.fn(() => valid);
        api.insertPlaintextIntoComposer("Guarded report", { view: "room" }, guard);
        valid = false;
        await act(async () => {
            vi.runOnlyPendingTimers();
        });
        expect(guard).toHaveBeenCalledOnce();
        expect(setSelection).not.toHaveBeenCalled();
        expect(functions.insertText).not.toHaveBeenCalled();
    });

    it("rechecks the destination after deferred selection restoration", async () => {
        const { functions } = setup();
        const resolve = deferSelection();
        let valid = true;
        const guard = vi.fn(() => valid);
        dispatch(guard);
        expect(setSelection).toHaveBeenCalledOnce();
        expect(functions.insertText).not.toHaveBeenCalled();
        valid = false;
        await act(async () => {
            resolve();
        });
        expect(guard).toHaveBeenCalledTimes(2);
        expect(functions.insertText).not.toHaveBeenCalled();
    });

    it("inserts once when the same destination is still valid after selection", async () => {
        const { functions } = setup();
        const resolve = deferSelection();
        const guard = vi.fn(() => true);
        dispatch(guard);
        await act(async () => {
            resolve();
        });
        expect(guard).toHaveBeenCalledTimes(2);
        expect(functions.insertText).toHaveBeenCalledExactlyOnceWith("Guarded report");
    });

    it("does not insert into an unmounted receiver after selection completes", async () => {
        const { functions, unmount } = setup();
        const resolve = deferSelection();
        dispatch(() => true);
        unmount();
        await act(async () => {
            resolve();
        });
        expect(functions.insertText).not.toHaveBeenCalled();
    });

    it("does not insert when the editor element was replaced while restoring selection", async () => {
        const { functions, element } = setup();
        const resolve = deferSelection();
        dispatch(() => true);
        element.current = document.createElement("div");
        await act(async () => {
            resolve();
        });
        expect(functions.insertText).not.toHaveBeenCalled();
    });

    it("does not insert when the receiver became disabled while restoring selection", async () => {
        const { functions, rerender } = setup();
        const resolve = deferSelection();
        dispatch(() => true);
        rerender({ disabled: true });
        await act(async () => {
            resolve();
        });
        expect(functions.insertText).not.toHaveBeenCalled();
    });
});
