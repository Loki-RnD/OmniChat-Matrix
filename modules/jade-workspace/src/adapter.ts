/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { ConversationContext, JadeAdapter, JadeAgent, JadeReport, JadeRequest, JadeTask } from "./contracts";

const STORAGE_KEY = "omnichat.jade.prototype.v1";
const MAX_TASKS = 100;
const workflows = ["sales-review", "stock-check", "custom"];

/** Reject malformed requests before creating any observable task. */
function validateRequest(request: JadeRequest): void {
    if (!request.requestId?.trim()) throw new Error("A request ID is required.");
    if (!["jade-loki", "jade-psk"].includes(request.agentId)) throw new Error("Choose a recognised Jade instance.");
    if (!request.context?.roomId?.trim()) throw new Error("A room context is required.");
    if (!["room", "thread"].includes(request.context.target)) throw new Error("Unknown conversation target.");
    if (!request.prompt?.trim() || request.prompt.length > 4000)
        throw new Error("Enter a prompt of 1–4,000 characters.");
    if (!workflows.includes(request.workflow)) throw new Error("Unknown workflow.");
}

function sameContext(left: ConversationContext, right: ConversationContext): boolean {
    return (
        left.roomId === right.roomId &&
        left.target === right.target &&
        left.inReplyToEventId === right.inReplyToEventId &&
        left.threadRootId === right.threadRootId &&
        left.relationType === right.relationType
    );
}

function requestMatches(left: JadeRequest, right: JadeRequest): boolean {
    return (
        left.agentId === right.agentId &&
        sameContext(left.context, right.context) &&
        left.prompt === right.prompt &&
        left.workflow === right.workflow &&
        Boolean(left.simulateFailure) === Boolean(right.simulateFailure)
    );
}

function isStoredTask(value: unknown): value is JadeTask {
    if (!value || typeof value !== "object") return false;
    const task = value as Partial<JadeTask>;
    try {
        validateRequest(task as JadeRequest);
    } catch {
        return false;
    }
    if (task.mode !== "demo" || !["queued", "running", "completed", "failed"].includes(task.status ?? "")) return false;
    if (typeof task.createdAt !== "string" || typeof task.updatedAt !== "string") return false;
    if (task.report) {
        const report = task.report;
        if (
            report.synthetic !== true ||
            typeof report.content !== "string" ||
            typeof report.title !== "string" ||
            typeof report.name !== "string" ||
            !Array.isArray(report.metrics) ||
            !Array.isArray(report.rows) ||
            !Array.isArray(report.columns)
        )
            return false;
    }
    return true;
}

function csvCell(value: string): string {
    return '"' + value.replaceAll('"', '""') + '"';
}

function makeReport(request: JadeRequest): JadeReport {
    const stock = request.workflow === "stock-check";
    const custom = request.workflow === "custom";
    const columns = stock
        ? ["Item", "On hand", "Reorder point", "Demo status"]
        : ["Channel", "NET SALES (KES)", "Orders", "vs prior demo week"];
    const rows = stock
        ? [
              ["Adult dry food · 10 kg", "42", "20", "Healthy"],
              ["Puppy food · 3 kg", "8", "15", "Reorder suggested"],
              ["Cat litter · 10 L", "64", "25", "Healthy"],
              ["Treats · 100 g", "12", "18", "Reorder suggested"],
          ]
        : [
              ["Retail", "845000", "184", "+8.4%"],
              ["Wholesale", "1260000", "48", "+12.1%"],
              ["Online", "315000", "112", "+6.8%"],
              ["TOTAL", "2420000", "344", "+10.1%"],
          ];
    const title = stock ? "Stock availability" : custom ? "Operations briefing" : "Weekly sales review";
    const summary = stock
        ? "In this synthetic sample, 2 of 4 items are below their reorder point. Review puppy food and treats first."
        : custom
          ? "This is a fixed demonstration briefing, not an AI response to your prompt. The sample illustrates how Jade will return a shareable result."
          : "Sample NET SALES are KES 2.42M across 344 orders, up 10.1% against the prior demo week. Wholesale contributes the largest share.";
    const metrics = stock
        ? [
              { label: "Items reviewed", value: "4", detail: "Synthetic catalogue" },
              { label: "Below reorder point", value: "2", detail: "Review suggested" },
              { label: "Units on hand", value: "126", detail: "Demo inventory" },
          ]
        : [
              { label: "NET SALES", value: "KES 2.42M", detail: "+10.1% vs prior demo week" },
              { label: "Orders", value: "344", detail: "Across 3 sample channels" },
              { label: "Average order", value: "KES 7,035", detail: "Rounded sample value" },
          ];
    const content = [
        "SYNTHETIC DEMONSTRATION DATA — NOT A COMPANY REPORT",
        title,
        "Agent: " + request.agentId,
        "NET SALES is a sample measure; no live financial or inventory system was accessed.",
        "",
        columns.map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
        "",
        summary,
    ].join("\n");
    return {
        title,
        summary,
        metrics,
        rows,
        columns,
        content,
        name: "jade-demo-" + (stock ? "stock-availability" : "weekly-sales") + ".csv",
        mimeType: "text/csv;charset=utf-8",
        synthetic: true,
    };
}

/** Local-only, deterministic adapter. It never contacts a model, gateway, or company system. */
export class DemoJadeAdapter implements JadeAdapter {
    public readonly mode = "demo" as const;
    public persistenceWarning: string | null = null;
    private readonly tasks = new Map<string, JadeTask>();
    private readonly listeners = new Map<string, Set<(task: JadeTask) => void>>();
    private readonly allListeners = new Set<() => void>();

    public constructor(private readonly storage?: Pick<Storage, "getItem" | "setItem">) {
        if (!storage) {
            this.persistenceWarning = "History is available for this session only.";
            return;
        }
        try {
            const saved = storage.getItem(STORAGE_KEY);
            if (!saved) return;
            const parsed: unknown = JSON.parse(saved);
            if (!Array.isArray(parsed) || parsed.some((task) => !isStoredTask(task))) {
                throw new Error("Invalid saved history");
            }
            for (const task of parsed.slice(-MAX_TASKS) as JadeTask[]) {
                if (task.status === "queued" || task.status === "running") {
                    task.status = "failed";
                    task.statusText = "Interrupted";
                    task.error = "This demonstration was interrupted by a reload. Retry to run it again.";
                    task.updatedAt = new Date().toISOString();
                }
                this.tasks.set(task.requestId, task);
            }
            this.persist();
        } catch {
            this.persistenceWarning = "Saved demo history could not be restored. New tasks still work in this session.";
        }
    }

    public list(context: ConversationContext, agentId: JadeAgent): JadeTask[] {
        return [...this.tasks.values()]
            .filter((task) => task.agentId === agentId && sameContext(task.context, context))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map((task) => structuredClone(task));
    }

    /** Remove finished demo tasks only from this exact conversation and Jade instance. */
    public clearHistory(context: ConversationContext, agentId: JadeAgent): number {
        let cleared = 0;
        for (const [requestId, task] of this.tasks) {
            if (
                task.agentId === agentId &&
                sameContext(task.context, context) &&
                (task.status === "completed" || task.status === "failed")
            ) {
                this.tasks.delete(requestId);
                cleared += 1;
            }
        }
        if (cleared) {
            this.persist();
            for (const listener of this.allListeners) listener();
        }
        return cleared;
    }

    public async submit(request: JadeRequest): Promise<JadeTask> {
        validateRequest(request);
        const existing = this.tasks.get(request.requestId);
        if (existing) {
            if (!requestMatches(existing, request)) throw new Error("This request ID already belongs to another task.");
            return structuredClone(existing);
        }
        const timestamp = new Date().toISOString();
        const task: JadeTask = {
            ...structuredClone(request),
            mode: this.mode,
            status: "queued",
            statusText: "Queued for the demo runner",
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.update(task);
        setTimeout(
            () =>
                this.update({
                    ...task,
                    status: "running",
                    statusText: "Preparing synthetic data",
                }),
            450,
        );
        setTimeout(() => {
            if (request.simulateFailure) {
                this.update({
                    ...task,
                    status: "failed",
                    statusText: "Demo failure simulated",
                    error: "A demo connection failure was simulated. Retry to complete the same workflow.",
                });
                return;
            }
            this.update({
                ...task,
                status: "completed",
                statusText: "Report ready",
                report: makeReport(request),
            });
        }, 1900);
        return structuredClone(task);
    }

    public subscribe(requestId: string, listener: (task: JadeTask) => void): () => void {
        const callbacks = this.listeners.get(requestId) ?? new Set();
        callbacks.add(listener);
        this.listeners.set(requestId, callbacks);
        const existing = this.tasks.get(requestId);
        if (existing) listener(structuredClone(existing));
        return () => {
            callbacks.delete(listener);
            if (callbacks.size === 0) this.listeners.delete(requestId);
        };
    }

    public subscribeAll(listener: () => void): () => void {
        this.allListeners.add(listener);
        return () => {
            this.allListeners.delete(listener);
        };
    }

    private update(task: JadeTask): void {
        const updated = { ...task, updatedAt: new Date().toISOString() };
        this.tasks.set(task.requestId, updated);
        if (this.tasks.size > MAX_TASKS) {
            const terminal = [...this.tasks.values()].find(
                (entry) => entry.status === "completed" || entry.status === "failed",
            );
            if (terminal) this.tasks.delete(terminal.requestId);
        }
        this.persist();
        for (const listener of this.listeners.get(task.requestId) ?? []) listener(structuredClone(updated));
        for (const listener of this.allListeners) listener();
    }

    private persist(): void {
        if (!this.storage) return;
        try {
            this.storage.setItem(STORAGE_KEY, JSON.stringify([...this.tasks.values()]));
        } catch {
            this.persistenceWarning = "Browser storage is unavailable. New tasks are kept only for this session.";
        }
    }
}

/** A truthful boundary until the authenticated LAN gateway contract is implemented. */
export class DisconnectedJadeAdapter implements JadeAdapter {
    public readonly mode = "disconnected" as const;
    public readonly persistenceWarning = null;
    private readonly tasks = new Map<string, JadeTask>();
    private readonly listeners = new Set<() => void>();

    public list(context: ConversationContext, agentId: JadeAgent): JadeTask[] {
        return [...this.tasks.values()]
            .filter((task) => task.agentId === agentId && sameContext(task.context, context))
            .map((task) => structuredClone(task))
            .reverse();
    }

    public async submit(request: JadeRequest): Promise<JadeTask> {
        validateRequest(request);
        const existing = this.tasks.get(request.requestId);
        if (existing) {
            if (!requestMatches(existing, request)) throw new Error("This request ID already belongs to another task.");
            return structuredClone(existing);
        }
        const task: JadeTask = {
            ...structuredClone(request),
            mode: this.mode,
            status: "failed",
            statusText: "Gateway not connected",
            error: "The LAN gateway is not configured. Choose Demo to explore with synthetic data.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.tasks.set(request.requestId, task);
        for (const listener of this.listeners) listener();
        return structuredClone(task);
    }

    public subscribe(requestId: string, listener: (task: JadeTask) => void): () => void {
        const task = this.tasks.get(requestId);
        if (task) listener(structuredClone(task));
        return this.subscribeAll(() => {
            const latest = this.tasks.get(requestId);
            if (latest) listener(structuredClone(latest));
        });
    }

    public subscribeAll(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

/** Storage may be disabled by browser policy; the demo remains usable without it. */
export function getDemoStorage(): Storage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}
