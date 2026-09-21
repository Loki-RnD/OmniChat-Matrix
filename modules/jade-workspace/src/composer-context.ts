/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { ConversationContext } from "./contracts";
import { canShare } from "./share";

interface ComposerLease {
    context: ConversationContext;
    userId: string;
    location: string;
}

/** Active composer leases expire on unmount, navigation, logout, or relationship changes. */
export class ComposerContextRegistry {
    private readonly leases = new Map<symbol, ComposerLease>();

    public constructor(
        private readonly getUserId: () => string | undefined,
        private readonly getLocation: () => string,
    ) {}

    public record(token: symbol, context: ConversationContext | null): void {
        const userId = this.getUserId();
        if (!context || !userId) {
            this.leases.delete(token);
            return;
        }
        this.leases.set(token, { context: { ...context }, userId, location: this.getLocation() });
    }

    public release(token: symbol): void {
        this.leases.delete(token);
    }

    public invalidate(): void {
        this.leases.clear();
    }

    public current(expected: ConversationContext): ConversationContext | null {
        const userId = this.getUserId();
        if (!userId) return null;
        for (const lease of this.leases.values()) {
            if (lease.userId === userId && lease.location === this.getLocation() && canShare(expected, lease.context))
                return { ...lease.context };
        }
        return null;
    }
}
