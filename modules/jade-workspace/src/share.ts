/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { ComposerShareTarget, ConversationContext } from "./contracts";

/** Match the complete captured relationship, never only the room or composer view. */
export function canShare(expected: ConversationContext, current: ConversationContext | null): boolean {
    if (!current || !expected.roomId) return false;
    if (expected.target === "thread" && !expected.threadRootId) return false;
    return (
        expected.roomId === current.roomId &&
        expected.target === current.target &&
        expected.inReplyToEventId === current.inReplyToEventId &&
        expected.threadRootId === current.threadRootId &&
        expected.relationType === current.relationType
    );
}

/** Check immediately before insertion; Element remains responsible for sending and encryption. */
export function shareReport(
    expected: ConversationContext,
    text: string,
    target?: ComposerShareTarget,
): { ok: boolean; reason: string } {
    if (!target || !canShare(expected, target.getCurrentContext())) {
        return {
            ok: false,
            reason: "Open the original room and exact reply or thread before adding this report to its composer.",
        };
    }
    target.insert(text, { view: expected.target });
    return { ok: true, reason: "Added to your message draft. Review it in Element before sending." };
}
