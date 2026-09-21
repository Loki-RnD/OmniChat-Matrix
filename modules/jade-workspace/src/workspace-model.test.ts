/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoJadeAdapter, DisconnectedJadeAdapter } from "./adapter";
import { WorkspaceModel } from "./workspace-model";
import type { ConversationContext } from "./contracts";

const context: ConversationContext = { roomId: "!sales:local", target: "room" };
const makeAdapters = () => ({ demo: new DemoJadeAdapter(), disconnected: new DisconnectedJadeAdapter() });

describe("room workspace model", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("runs a workflow and opens its completed report", async () => {
        const model = new WorkspaceModel(context, makeAdapters());
        await model.run("sales-review", "Review sales");
        expect(model.getSnapshot().tasks[0].status).toBe("queued");
        await vi.runAllTimersAsync();
        const task = model.getSnapshot().tasks[0];
        expect(task.status).toBe("completed");
        model.openReport(task.requestId);
        expect(model.getSnapshot().tab).toBe("reports");
        expect(model.getSnapshot().selectedReportId).toBe(task.requestId);
        model.dispose();
    });

    it("retains separate histories when changing agents and rooms", async () => {
        const adapters = makeAdapters();
        const model = new WorkspaceModel(context, adapters);
        await model.run("stock-check", "Review stock");
        await vi.runAllTimersAsync();
        model.setAgent("jade-psk");
        expect(model.getSnapshot().tasks).toHaveLength(0);
        model.setAgent("jade-loki");
        expect(model.getSnapshot().tasks).toHaveLength(1);
        const other = new WorkspaceModel({ ...context, roomId: "!other:local" }, adapters);
        expect(other.getSnapshot().tasks).toHaveLength(0);
        model.dispose();
        other.dispose();
    });

    it("exposes disconnected errors without completed reports", async () => {
        const model = new WorkspaceModel(context, makeAdapters());
        model.setMode("disconnected");
        await model.run("sales-review", "Review sales");
        expect(model.getSnapshot().tasks[0].status).toBe("failed");
        expect(model.getSnapshot().tasks[0].report).toBeUndefined();
        model.setMode("demo");
        expect(model.getSnapshot().tasks).toHaveLength(0);
        model.dispose();
    });

    it("shows validation errors and retries simulated failures successfully", async () => {
        const model = new WorkspaceModel(context, makeAdapters());
        await model.run("custom");
        expect(model.getSnapshot().error).toContain("prompt");
        model.setSimulateFailure(true);
        await model.run("sales-review", "Review sales");
        await vi.runAllTimersAsync();
        const failed = model.getSnapshot().tasks[0];
        expect(failed.status).toBe("failed");
        await model.retry(failed);
        await vi.runAllTimersAsync();
        expect(model.getSnapshot().tasks.some((task) => task.status === "completed")).toBe(true);
        expect(model.getSnapshot().simulateFailure).toBe(false);
        model.dispose();
    });

    it("rejects a composer that went stale after rendering", async () => {
        let current: ConversationContext | null = context;
        const insert = vi.fn();
        const model = new WorkspaceModel(context, makeAdapters(), { getCurrentContext: () => current, insert });
        await model.run("sales-review", "Review sales");
        await vi.runAllTimersAsync();
        expect(model.getSnapshot().sharingAvailable).toBe(true);
        current = { ...context, inReplyToEventId: "$different-reply" };
        model.share(model.getSnapshot().tasks[0]);
        expect(insert).not.toHaveBeenCalled();
        expect(model.getSnapshot().error).toContain("original room");
        expect(model.getSnapshot().sharingAvailable).toBe(false);
        model.dispose();
    });

    it("inserts a labelled result into a verified draft and unsubscribes on dispose", async () => {
        const insert = vi.fn();
        const model = new WorkspaceModel(context, makeAdapters(), { getCurrentContext: () => context, insert });
        const listener = vi.fn();
        model.subscribe(listener);
        await model.run("sales-review", "Review sales");
        await vi.runAllTimersAsync();
        model.share(model.getSnapshot().tasks[0]);
        expect(insert).toHaveBeenCalledWith(expect.stringContaining("SYNTHETIC DATA"), { view: "room" });
        expect(model.getSnapshot().notice).toContain("insertion requested");
        model.dispose();
        listener.mockClear();
        model.notify("after disposal");
        expect(listener).not.toHaveBeenCalled();
    });
});
