/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Honest connection states for the prototype and future LAN adapter. */
export type JadeMode = "demo" | "disconnected" | "connected";
export type JadeStatus = "queued" | "running" | "completed" | "failed";
export type JadeAgent = "jade-loki" | "jade-psk";
export type JadeWorkflow = "sales-review" | "stock-check" | "custom";

/** Captured from Element's public composer API; reply IDs are never guessed. */
export interface ConversationContext {
    roomId: string;
    target: "room" | "thread";
    inReplyToEventId?: string;
    threadRootId?: string;
    relationType?: string;
}

/** An idempotent request to one Jade instance in one conversation. */
export interface JadeRequest {
    requestId: string;
    agentId: JadeAgent;
    context: ConversationContext;
    prompt: string;
    workflow: JadeWorkflow;
    simulateFailure?: boolean;
}

/** A downloadable result with explicit data provenance. */
export interface JadeReport {
    name: string;
    mimeType: string;
    content: string;
    synthetic: boolean;
    title: string;
    summary: string;
    metrics: { label: string; value: string; detail: string }[];
    rows: string[][];
    columns: string[];
}

/** Observable work with immutable origin context. */
export interface JadeTask extends JadeRequest {
    status: JadeStatus;
    statusText: string;
    mode: JadeMode;
    createdAt: string;
    updatedAt: string;
    report?: JadeReport;
    error?: string;
}

/** Future gateway implementations must honour the same context and lifecycle contract. */
export interface JadeAdapter {
    readonly mode: JadeMode;
    readonly persistenceWarning: string | null;
    submit(request: JadeRequest): Promise<JadeTask>;
    subscribe(requestId: string, listener: (task: JadeTask) => void): () => void;
    subscribeAll(listener: () => void): () => void;
    list(context: ConversationContext, agentId: JadeAgent): JadeTask[];
}

/** Element composer insertion is allowed only while this target remains verifiable. */
export interface ComposerShareTarget {
    getCurrentContext(): ConversationContext | null;
    insert(text: string, target: { view: "room" | "thread" }): void;
}
