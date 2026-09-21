/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type {
    ComposerShareTarget,
    ConversationContext,
    JadeAdapter,
    JadeAgent,
    JadeTask,
    JadeWorkflow,
} from "./contracts";
import { canShare, shareReport } from "./share";

export type WorkspaceTab = "tasks" | "reports" | "tools";

/** Immutable UI state; the view only renders this snapshot and invokes model actions. */
export interface WorkspaceSnapshot {
    agentId: JadeAgent;
    tab: WorkspaceTab;
    prompt: string;
    tasks: JadeTask[];
    mode: "demo" | "disconnected";
    simulateFailure: boolean;
    notice: string;
    error: string;
    selectedReportId: string | null;
    sharingAvailable: boolean;
    persistenceWarning: string | null;
}

/** Coordinates a room-scoped adapter without importing Element or accessing a company API. */
export class WorkspaceModel {
    private readonly listeners = new Set<() => void>();
    private unsubscribe: () => void;
    private snapshot: WorkspaceSnapshot;

    public constructor(
        public readonly context: ConversationContext,
        private readonly adapters: { demo: JadeAdapter; disconnected: JadeAdapter },
        private readonly shareTarget?: ComposerShareTarget,
        initialPrompt = "",
        initialAgent: JadeAgent = "jade-loki",
    ) {
        this.snapshot = {
            agentId: initialAgent,
            tab: "tasks",
            prompt: initialPrompt,
            tasks: [],
            mode: "demo",
            simulateFailure: false,
            notice: "",
            error: "",
            selectedReportId: null,
            sharingAvailable: canShare(context, shareTarget?.getCurrentContext() ?? null),
            persistenceWarning: adapters.demo.persistenceWarning,
        };
        this.unsubscribe = this.adapter.subscribeAll(this.refresh);
        this.refresh();
    }

    private get adapter(): JadeAdapter {
        return this.adapters[this.snapshot.mode];
    }

    public getSnapshot = (): WorkspaceSnapshot => this.snapshot;

    public subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    public dispose = (): void => {
        this.unsubscribe();
        this.listeners.clear();
    };

    private merge(patch: Partial<WorkspaceSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...patch };
        for (const listener of this.listeners) listener();
    }

    public refresh = (): void => {
        this.merge({
            tasks: this.adapter.list(this.context, this.snapshot.agentId),
            sharingAvailable: canShare(this.context, this.shareTarget?.getCurrentContext() ?? null),
            persistenceWarning: this.adapter.persistenceWarning,
        });
    };

    public setAgent = (agentId: JadeAgent): void => {
        this.merge({ agentId, selectedReportId: null, notice: "", error: "" });
        this.refresh();
    };

    public setMode = (mode: "demo" | "disconnected"): void => {
        this.unsubscribe();
        this.merge({ mode, selectedReportId: null, notice: "", error: "" });
        this.unsubscribe = this.adapter.subscribeAll(this.refresh);
        this.refresh();
    };

    public setTab = (tab: WorkspaceTab): void => {
        this.merge({ tab, notice: "", error: "" });
    };
    public setPrompt = (prompt: string): void => {
        this.merge({ prompt });
    };
    public setSimulateFailure = (simulateFailure: boolean): void => {
        this.merge({ simulateFailure });
    };
    public notify = (notice: string): void => {
        this.merge({ notice, error: "" });
    };

    public openReport = (requestId: string): void => {
        this.merge({ tab: "reports", selectedReportId: requestId, notice: "", error: "" });
    };

    public run = async (workflow: JadeWorkflow, presetPrompt?: string): Promise<void> => {
        const prompt = presetPrompt ?? this.snapshot.prompt;
        this.merge({ error: "", notice: "", tab: "tasks" });
        try {
            await this.adapter.submit({
                requestId: crypto.randomUUID(),
                agentId: this.snapshot.agentId,
                context: { ...this.context },
                prompt,
                workflow,
                simulateFailure: this.snapshot.mode === "demo" && this.snapshot.simulateFailure,
            });
            this.merge({ prompt: "", simulateFailure: false });
            this.refresh();
        } catch (error) {
            this.merge({ error: error instanceof Error ? error.message : "The task could not be started." });
        }
    };

    public retry = async (task: JadeTask): Promise<void> => {
        this.merge({ simulateFailure: false });
        await this.run(task.workflow, task.prompt);
    };

    public share = (task: JadeTask): void => {
        if (!task.report) return;
        const report = task.report;
        const text = [
            "[DEMO · SYNTHETIC DATA] " + report.title,
            report.summary,
            "",
            ...report.metrics.map((metric) => metric.label + ": " + metric.value),
            "",
            "Prepared in OmniChat's local Jade demo. No live company system was accessed.",
        ].join("\n");
        const result = shareReport(task.context, text, this.shareTarget);
        this.merge({ notice: result.ok ? result.reason : "", error: result.ok ? "" : result.reason });
        this.refresh();
    };
}
