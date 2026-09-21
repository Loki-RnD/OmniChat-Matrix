/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";
import { ComposerContextRegistry } from "./composer-context";
import type { ConversationContext } from "./contracts";

const room: ConversationContext = { roomId: "!room:local", target: "room" };
const reply: ConversationContext = { ...room, inReplyToEventId: "$reply", relationType: "m.reference" };

describe("mounted composer leases", () => {
    it("releases a composer on unmount and invalidates navigation", () => {
        let location = "#/room/a";
        const registry = new ComposerContextRegistry(
            () => "@demo:local",
            () => location,
        );
        const token = Symbol("composer");
        registry.record(token, room);
        expect(registry.current(room)).toEqual(room);
        registry.release(token);
        expect(registry.current(room)).toBeNull();
        registry.record(token, room);
        location = "#/room/b";
        expect(registry.current(room)).toBeNull();
        registry.invalidate();
        location = "#/room/a";
        expect(registry.current(room)).toBeNull();
    });

    it("rejects logged-out and different-account composers", () => {
        let userId: string | undefined = "@one:local";
        const registry = new ComposerContextRegistry(
            () => userId,
            () => "#/room/a",
        );
        registry.record(Symbol("composer"), room);
        userId = undefined;
        expect(registry.current(room)).toBeNull();
        userId = "@two:local";
        expect(registry.current(room)).toBeNull();
    });

    it("updates the exact relation and rejects unverifiable props", () => {
        const registry = new ComposerContextRegistry(
            () => "@demo:local",
            () => "#/room/a",
        );
        const token = Symbol("composer");
        registry.record(token, room);
        registry.record(token, reply);
        expect(registry.current(room)).toBeNull();
        expect(registry.current(reply)).toEqual(reply);
        registry.record(token, null);
        expect(registry.current(reply)).toBeNull();
    });
});
