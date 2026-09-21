/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoJadeAdapter, DisconnectedJadeAdapter } from "./adapter";
import type { JadeRequest } from "./contracts";

const request: JadeRequest = {
    requestId: "demo-1",
    agentId: "jade-loki",
    context: { roomId: "!sales:local", target: "room" },
    prompt: "Review weekly sales",
    workflow: "sales-review",
};

function memoryStorage(): Storage {
    const values = new Map<string, string>();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
        clear: () => values.clear(),
        key: (index) => [...values.keys()][index] ?? null,
        get length() {
            return values.size;
        },
    };
}

describe("synthetic Jade adapter", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("keeps one request identity across queued, running and completed", async () => {
        const adapter = new DemoJadeAdapter(memoryStorage());
        const observed: string[] = [];
        const unsubscribe = adapter.subscribe(request.requestId, (task) => observed.push(task.status));
        expect((await adapter.submit(request)).status).toBe("queued");
        await vi.runAllTimersAsync();
        expect(observed).toEqual(["queued", "running", "completed"]);
        const [task] = adapter.list(request.context, request.agentId);
        expect(task.requestId).toBe(request.requestId);
        expect(task.context).toEqual(request.context);
        expect(task.report?.content).toContain("SYNTHETIC");
        expect(task.report?.content).toContain("NET SALES");
        unsubscribe();
    });

    it("deduplicates requests and separates rooms, threads and agents", async () => {
        const adapter = new DemoJadeAdapter(memoryStorage());
        await adapter.submit(request);
        await adapter.submit(request);
        const otherRoom = {
            ...request,
            requestId: "other-room",
            context: { ...request.context, roomId: "!other:local" },
        };
        await adapter.submit(otherRoom);
        await adapter.submit({ ...request, requestId: "other-agent", agentId: "jade-psk" });
        await adapter.submit({
            ...request,
            requestId: "thread",
            context: { ...request.context, target: "thread", threadRootId: "$thread" },
        });
        expect(adapter.list(request.context, request.agentId)).toHaveLength(1);
        expect(adapter.list(otherRoom.context, request.agentId)).toHaveLength(1);
        await expect(adapter.submit({ ...request, prompt: "changed" })).rejects.toThrow("already belongs");
    });

    it("surfaces failure and permits retry with a new id", async () => {
        const adapter = new DemoJadeAdapter(memoryStorage());
        await adapter.submit({ ...request, simulateFailure: true });
        await vi.runAllTimersAsync();
        expect(adapter.list(request.context, request.agentId)[0].status).toBe("failed");
        await adapter.submit({ ...request, requestId: "retry" });
        await vi.runAllTimersAsync();
        expect(adapter.list(request.context, request.agentId).find((task) => task.requestId === "retry")?.status).toBe(
            "completed",
        );
    });

    it("unsubscribes and persists terminal tasks across reload", async () => {
        const storage = memoryStorage();
        const adapter = new DemoJadeAdapter(storage);
        const listener = vi.fn();
        const unsubscribe = adapter.subscribe(request.requestId, listener);
        await adapter.submit(request);
        unsubscribe();
        await vi.runAllTimersAsync();
        expect(listener).toHaveBeenCalledTimes(1);
        const restored = new DemoJadeAdapter(storage);
        expect(restored.list(request.context, request.agentId)[0].status).toBe("completed");
    });

    it("marks interrupted work honestly on reload", async () => {
        const storage = memoryStorage();
        await new DemoJadeAdapter(storage).submit(request);
        const restored = new DemoJadeAdapter(storage);
        expect(restored.list(request.context, request.agentId)[0].status).toBe("failed");
        expect(restored.list(request.context, request.agentId)[0].error).toContain("interrupted");
    });

    it("makes no network requests and validates malformed input", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        const adapter = new DemoJadeAdapter(memoryStorage());
        await adapter.submit(request);
        await vi.runAllTimersAsync();
        expect(fetchSpy).not.toHaveBeenCalled();
        await expect(adapter.submit({ ...request, requestId: "bad", prompt: "  " })).rejects.toThrow("prompt");
        await expect(
            adapter.submit({ ...request, requestId: "bad", workflow: "unknown" as JadeRequest["workflow"] }),
        ).rejects.toThrow("workflow");
        await expect(
            adapter.submit({ ...request, requestId: "bad", context: { roomId: "", target: "room" } }),
        ).rejects.toThrow("room");
    });

    it("survives corrupt or unavailable storage with an explicit warning", async () => {
        const storage = memoryStorage();
        storage.setItem("omnichat.jade.prototype.v1", "{oops");
        const adapter = new DemoJadeAdapter(storage);
        expect(adapter.persistenceWarning).toBeTruthy();
        await adapter.submit(request);
        await vi.runAllTimersAsync();
        expect(adapter.list(request.context, request.agentId)).toHaveLength(1);
    });

    it("never claims an unconfigured gateway succeeded", async () => {
        const adapter = new DisconnectedJadeAdapter();
        const task = await adapter.submit(request);
        expect(adapter.mode).toBe("disconnected");
        expect(task.status).toBe("failed");
        expect(task.report).toBeUndefined();
        expect(task.error).toContain("not configured");
    });

    it("keeps different thread roots and replies in separate histories", async () => {
        const adapter = new DemoJadeAdapter(memoryStorage());
        const first = {
            roomId: request.context.roomId,
            target: "thread" as const,
            threadRootId: "$first",
            relationType: "m.thread",
        };
        const second = { ...first, threadRootId: "$second" };
        const reply = { ...first, inReplyToEventId: "$reply" };
        await adapter.submit({ ...request, requestId: "root-one", context: first });
        await adapter.submit({ ...request, requestId: "root-two", context: second });
        await adapter.submit({ ...request, requestId: "reply-one", context: reply });
        expect(adapter.list(first, request.agentId).map((task) => task.requestId)).toEqual(["root-one"]);
        expect(adapter.list(second, request.agentId).map((task) => task.requestId)).toEqual(["root-two"]);
        expect(adapter.list(reply, request.agentId).map((task) => task.requestId)).toEqual(["reply-one"]);
        await vi.runAllTimersAsync();
    });

    it("clears only finished tasks for the selected conversation and agent, durably", async () => {
        const storage = memoryStorage();
        const adapter = new DemoJadeAdapter(storage);
        const otherRoom = { ...request.context, roomId: "!other:local" };
        const thread = { ...request.context, target: "thread" as const, threadRootId: "$thread" };
        await adapter.submit(request);
        await adapter.submit({ ...request, requestId: "other-agent", agentId: "jade-psk" });
        await adapter.submit({ ...request, requestId: "other-room", context: otherRoom });
        await adapter.submit({ ...request, requestId: "thread", context: thread });
        await vi.runAllTimersAsync();
        await adapter.submit({ ...request, requestId: "still-running" });
        const changed = vi.fn();
        adapter.subscribeAll(changed);
        expect(adapter.clearHistory(request.context, request.agentId)).toBe(1);
        expect(changed).toHaveBeenCalledOnce();
        expect(adapter.list(request.context, request.agentId).map((task) => task.requestId)).toEqual(["still-running"]);
        expect(adapter.list(request.context, "jade-psk")).toHaveLength(1);
        expect(adapter.list(otherRoom, request.agentId)).toHaveLength(1);
        expect(adapter.list(thread, request.agentId)).toHaveLength(1);
        await vi.runAllTimersAsync();
        expect(adapter.list(request.context, request.agentId)[0].status).toBe("completed");
        const reloaded = new DemoJadeAdapter(storage);
        expect(reloaded.list(request.context, request.agentId).map((task) => task.requestId)).toEqual([
            "still-running",
        ]);
        expect(adapter.clearHistory(otherRoom, "jade-psk")).toBe(0);
    });
});
