/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { canShare, shareReport } from "./share";
import type { ComposerShareTarget, ConversationContext } from "./contracts";

const room: ConversationContext = { roomId: "!a:local", target: "room" };
const thread: ConversationContext = {
    roomId: "!a:local",
    target: "thread",
    threadRootId: "$root",
    inReplyToEventId: "$reply",
    relationType: "m.thread",
};

describe("exact composer context", () => {
    it("accepts an exact room or identified thread", () => {
        expect(canShare(room, { ...room })).toBe(true);
        expect(canShare(thread, { ...thread })).toBe(true);
    });

    it.each([
        { ...thread, roomId: "!b:local" },
        { ...thread, target: "room" as const },
        { ...thread, inReplyToEventId: "$other" },
        { ...thread, threadRootId: "$other-thread" },
        { ...thread, relationType: "m.reference" },
        null,
    ])("rejects mismatched and unavailable contexts", (current) => {
        expect(canShare(thread, current)).toBe(false);
    });

    it("refuses an unidentified thread", () => {
        const unidentified = { roomId: "!a:local", target: "thread" as const };
        expect(canShare(unidentified, unidentified)).toBe(false);
    });

    it("rechecks at insertion time after stale rendering", () => {
        let current: ConversationContext | null = room;
        const target: ComposerShareTarget = { getCurrentContext: () => current, insert: vi.fn() };
        expect(canShare(room, target.getCurrentContext())).toBe(true);
        current = { ...room, roomId: "!b:local" };
        expect(shareReport(room, "SYNTHETIC report", target).ok).toBe(false);
        expect(target.insert).not.toHaveBeenCalled();
        current = null;
        expect(shareReport(room, "SYNTHETIC report", target).ok).toBe(false);
        expect(target.insert).not.toHaveBeenCalled();
    });

    it("inserts into the verified native composer without sending a message", () => {
        const target: ComposerShareTarget = { getCurrentContext: () => thread, insert: vi.fn() };
        expect(shareReport(thread, "SYNTHETIC report", target).ok).toBe(true);
        expect(target.insert).toHaveBeenCalledExactlyOnceWith("SYNTHETIC report", { view: "thread" });
    });

    it("allows a known thread root without inventing a reply event", () => {
        const root = { roomId: "!a:local", target: "thread" as const, threadRootId: "$root", relationType: "m.thread" };
        expect(canShare(root, { ...root })).toBe(true);
        expect(canShare(root, { ...root, inReplyToEventId: "$reply" })).toBe(false);
    });
});
