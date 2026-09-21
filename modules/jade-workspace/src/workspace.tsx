/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useEffect, useMemo, useSyncExternalStore, type JSX } from "react";

import type { ComposerShareTarget, ConversationContext, JadeAdapter, JadeAgent, JadeTask } from "./contracts";
import { Icon } from "./icons";
import { WorkspaceModel, type WorkspaceTab } from "./workspace-model";

interface WorkspaceProps {
    context: ConversationContext;
    roomName: string;
    adapters: { demo: JadeAdapter; disconnected: JadeAdapter };
    shareTarget?: ComposerShareTarget;
    initialPrompt?: string;
    initialAgent?: JadeAgent;
    onClose?: () => void;
    standalone?: boolean;
}

function download(task: JadeTask): void {
    if (!task.report) return;
    const url = URL.createObjectURL(new Blob([task.report.content], { type: task.report.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = task.report.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function relativeTime(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TaskCard({ task, model }: { task: JadeTask; model: WorkspaceModel }): JSX.Element {
    const active = task.status === "running" || task.status === "queued";
    return (
        <article className={"jade-task jade-task--" + task.status}>
            <div className="jade-task__icon">
                <Icon name={task.status === "completed" ? "check" : active ? "clock" : "retry"} />
            </div>
            <div className="jade-task__body">
                <div className="jade-task__heading">
                    <h3>{task.prompt}</h3>
                    <time dateTime={task.createdAt}>{relativeTime(task.createdAt)}</time>
                </div>
                <div className="jade-task__meta">
                    <span className={"jade-state jade-state--" + task.status}>
                        {active && <span className="jade-pulse" />}
                        {task.statusText}
                    </span>
                    <span>{task.agentId === "jade-loki" ? "Jade · Loki" : "Jade · PetStore Kenya"}</span>
                    <span>{task.mode === "demo" ? "Synthetic data" : "Disconnected"}</span>
                </div>
                {task.error && <p className="jade-error-text">{task.error}</p>}
                {task.report && <p className="jade-task__summary">{task.report.summary}</p>}
                {active && (
                    <div className="jade-progress" aria-label="Task is processing">
                        <span />
                    </div>
                )}
                {task.report && (
                    <button type="button" className="jade-text-button" onClick={() => model.openReport(task.requestId)}>
                        View report <Icon name="arrow" size={16} />
                    </button>
                )}
                {task.status === "failed" && (
                    <button type="button" className="jade-text-button" onClick={() => void model.retry(task)}>
                        <Icon name="retry" size={16} /> Retry task
                    </button>
                )}
            </div>
        </article>
    );
}

function EmptyState({ reports = false }: { reports?: boolean }): JSX.Element {
    return (
        <div className="jade-empty">
            <span className="jade-empty__icon">
                <Icon name={reports ? "file" : "spark"} size={27} />
            </span>
            <h3>{reports ? "Your reports will live here" : "A little less busywork."}</h3>
            <p>
                {reports
                    ? "Run a workflow to create a clearly labelled sample report you can preview, download, or share."
                    : "Ask Jade to prepare a sales review or check stock. You can follow the work here as it happens."}
            </p>
            {!reports && <span className="jade-small-label">ROOM CONTEXT STAYS WITH EVERY TASK</span>}
        </div>
    );
}

/** Shared Element dialog and standalone view. All task actions are delegated to its model. */
export function JadeWorkspace(props: WorkspaceProps): JSX.Element {
    const { context, adapters, shareTarget, initialPrompt, initialAgent } = props;
    const { roomId, target, inReplyToEventId, threadRootId, relationType } = context;
    const model = useMemo(
        () =>
            new WorkspaceModel(
                { roomId, target, inReplyToEventId, threadRootId, relationType },
                adapters,
                shareTarget,
                initialPrompt,
                initialAgent,
            ),
        [
            roomId,
            target,
            inReplyToEventId,
            threadRootId,
            relationType,
            adapters,
            shareTarget,
            initialPrompt,
            initialAgent,
        ],
    );
    const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
    useEffect(() => {
        // Context can change behind an Element dialog. Revalidate it visibly as well as at click time.
        const timer = setInterval(model.refresh, 750);
        return () => {
            clearInterval(timer);
            model.dispose();
        };
    }, [model]);
    const reports = state.tasks.filter((task) => task.report);
    const selected = reports.find((task) => task.requestId === state.selectedReportId) ?? reports[0];
    const activeCount = state.tasks.filter((task) => task.status === "running" || task.status === "queued").length;
    const tabs: { id: WorkspaceTab; label: string; count?: number }[] = [
        { id: "tasks", label: "Tasks", count: state.tasks.length },
        { id: "reports", label: "Reports", count: reports.length },
        { id: "tools", label: "Tools" },
    ];

    return (
        <section
            className={"jade-workspace" + (props.standalone ? " jade-workspace--standalone" : "")}
            aria-label="Jade workspace"
        >
            <header className="jade-header">
                <div className="jade-breadcrumb">
                    <Icon name="room" size={17} />
                    <span>{props.roomName}</span>
                    <span className="jade-breadcrumb__slash">/</span>
                    <strong>Jade</strong>
                    {context.target === "thread" && <span className="jade-chip">Thread</span>}
                    {context.inReplyToEventId && context.target === "room" && <span className="jade-chip">Reply</span>}
                </div>
                <div className="jade-header__actions">
                    <span className={"jade-connection " + (state.mode === "demo" ? "jade-connection--demo" : "")}>
                        <span />
                        {state.mode === "demo" ? "Demo · synthetic data" : "Gateway disconnected"}
                    </span>
                    {props.onClose && (
                        <button
                            type="button"
                            className="jade-icon-button"
                            aria-label="Close Jade workspace"
                            onClick={props.onClose}
                        >
                            <Icon name="close" />
                        </button>
                    )}
                </div>
            </header>

            <div className="jade-main">
                <div className="jade-intro">
                    <div>
                        <span className="jade-eyebrow">
                            <Icon name="spark" size={15} /> YOUR TEAM'S WORKING PARTNER
                        </span>
                        <h1>From conversation to action.</h1>
                        <p>Give Jade a task. Keep the context. Bring the result back to your team.</p>
                    </div>
                    <label className="jade-agent-select">
                        <span>Working with</span>
                        <select
                            aria-label="Jade instance"
                            value={state.agentId}
                            onChange={(event) => model.setAgent(event.target.value as JadeAgent)}
                        >
                            <option value="jade-loki">Jade · Loki Ventures</option>
                            <option value="jade-psk">Jade · PetStore Kenya</option>
                        </select>
                    </label>
                </div>

                <nav className="jade-tabs" aria-label="Workspace sections">
                    {tabs.map((tab) => (
                        <button
                            type="button"
                            key={tab.id}
                            className={state.tab === tab.id ? "jade-tab is-active" : "jade-tab"}
                            aria-current={state.tab === tab.id ? "page" : undefined}
                            onClick={() => model.setTab(tab.id)}
                        >
                            <Icon
                                name={tab.id === "tasks" ? "bolt" : tab.id === "reports" ? "file" : "tools"}
                                size={17}
                            />
                            {tab.label}
                            {tab.count !== undefined && <span>{tab.count}</span>}
                        </button>
                    ))}
                    <span className="jade-tabs__note">
                        {activeCount ? activeCount + " task running" : "Made for this room"}
                    </span>
                </nav>

                {state.error && (
                    <div className="jade-notice jade-notice--error" role="alert">
                        {state.error}
                    </div>
                )}
                {state.notice && (
                    <div className="jade-notice" role="status">
                        {state.notice}
                    </div>
                )}
                {state.persistenceWarning && (
                    <div className="jade-notice jade-notice--warning">{state.persistenceWarning}</div>
                )}

                {state.tab === "tasks" && (
                    <>
                        <div className="jade-starters">
                            <button
                                type="button"
                                onClick={() => void model.run("sales-review", "Prepare a weekly sales review")}
                                className="jade-starter"
                            >
                                <span className="jade-starter__icon">
                                    <Icon name="chart" />
                                </span>
                                <span>
                                    <strong>Weekly sales review</strong>
                                    <small>Performance, channels & next steps</small>
                                </span>
                                <Icon name="arrow" size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => void model.run("stock-check", "Check stock availability")}
                                className="jade-starter"
                            >
                                <span className="jade-starter__icon jade-starter__icon--gold">
                                    <Icon name="box" />
                                </span>
                                <span>
                                    <strong>Check stock availability</strong>
                                    <small>Spot shortages before they slow you down</small>
                                </span>
                                <Icon name="arrow" size={18} />
                            </button>
                        </div>
                        <form
                            className="jade-compose"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void model.run("custom");
                            }}
                        >
                            <label htmlFor="jade-prompt">
                                <Icon name="spark" size={19} />
                                <span>What can Jade help you with?</span>
                            </label>
                            <textarea
                                id="jade-prompt"
                                value={state.prompt}
                                maxLength={4000}
                                placeholder="Prepare a briefing for our next team meeting…"
                                onChange={(event) => model.setPrompt(event.target.value)}
                                rows={2}
                            />
                            <div className="jade-compose__footer">
                                <span>
                                    <Icon name="lock" size={13} />
                                    {state.mode === "demo"
                                        ? "Local demo · no company data accessed"
                                        : "No live gateway configured"}
                                </span>
                                <button className="jade-primary" type="submit" disabled={!state.prompt.trim()}>
                                    {state.mode === "demo" ? "Run demo" : "Try connection"}
                                    <Icon name="arrow" size={16} />
                                </button>
                            </div>
                        </form>
                        <div className="jade-section-title">
                            <h2>Room activity</h2>
                            <span>
                                {state.tasks.length} {state.tasks.length === 1 ? "task" : "tasks"}
                            </span>
                        </div>
                        {state.tasks.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <div className="jade-task-list" aria-live="polite">
                                {state.tasks.map((task) => (
                                    <TaskCard key={task.requestId} task={task} model={model} />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {state.tab === "reports" &&
                    (selected?.report ? (
                        <div className="jade-report">
                            {reports.length > 1 && (
                                <label className="jade-report-select">
                                    Report
                                    <select
                                        value={selected.requestId}
                                        onChange={(event) => model.openReport(event.target.value)}
                                    >
                                        {reports.map((task) => (
                                            <option key={task.requestId} value={task.requestId}>
                                                {task.report?.title} · {relativeTime(task.createdAt)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <div className="jade-report__heading">
                                <div>
                                    <span className="jade-eyebrow">JADE / DEMONSTRATION REPORT</span>
                                    <h2>{selected.report.title}</h2>
                                    <p>
                                        Prepared for {props.roomName} · {relativeTime(selected.createdAt)}
                                    </p>
                                </div>
                                <span className="jade-chip jade-chip--demo">Synthetic sample</span>
                            </div>
                            <div className="jade-metrics">
                                {selected.report.metrics.map((metric) => (
                                    <div key={metric.label}>
                                        <span>{metric.label}</span>
                                        <strong>{metric.value}</strong>
                                        <small>{metric.detail}</small>
                                    </div>
                                ))}
                            </div>
                            <div className="jade-report__insight">
                                <Icon name="spark" />
                                <p>{selected.report.summary}</p>
                            </div>
                            <div className="jade-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            {selected.report.columns.map((column) => (
                                                <th key={column}>{column}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selected.report.rows.map((row) => (
                                            <tr key={row[0]}>
                                                {row.map((cell, column) => (
                                                    <td key={selected.report!.columns[column]}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="jade-provenance">
                                All figures are synthetic. This demo does not query company databases or run an AI
                                model.
                            </p>
                            <div className="jade-report-actions">
                                <button type="button" className="jade-primary" onClick={() => download(selected)}>
                                    <Icon name="download" size={17} />
                                    Download CSV
                                </button>
                                <button
                                    type="button"
                                    className="jade-secondary"
                                    onClick={() => {
                                        void navigator.clipboard
                                            .writeText(selected.report!.content)
                                            .then(() => model.notify("Synthetic report copied."))
                                            .catch(() =>
                                                model.notify(
                                                    "Clipboard access is unavailable. Use Download CSV instead.",
                                                ),
                                            );
                                    }}
                                >
                                    <Icon name="copy" size={16} />
                                    Copy report
                                </button>
                                <button
                                    type="button"
                                    className="jade-secondary"
                                    disabled={!state.sharingAvailable}
                                    onClick={() => model.share(selected)}
                                >
                                    <Icon name="arrow" size={16} />
                                    Add to message draft
                                </button>
                            </div>
                            <p className="jade-share-hint">
                                {props.standalone
                                    ? "Open Jade inside an Element room to add a report to its message draft."
                                    : state.sharingAvailable
                                      ? "You review and send the draft using Element's normal composer."
                                      : "Sharing is available only while the original room and exact reply or thread are still open."}
                            </p>
                        </div>
                    ) : (
                        <EmptyState reports />
                    ))}

                {state.tab === "tools" && (
                    <div className="jade-tools">
                        <div className="jade-tools__intro">
                            <h2>Everything Jade can work with.</h2>
                            <p>
                                Explore the sample workflows now. Live company tools require an authenticated gateway
                                connection.
                            </p>
                        </div>
                        {[
                            {
                                icon: "chart" as const,
                                title: "Sales reporting",
                                text: "Weekly NET SALES, channel performance and downloadable reports.",
                                available: true,
                            },
                            {
                                icon: "box" as const,
                                title: "Inventory",
                                text: "Stock availability and reorder suggestions using a sample catalogue.",
                                available: true,
                            },
                            {
                                icon: "link" as const,
                                title: "Company data & OpenClaw",
                                text: "The future LAN connection for authorised Jade tasks and company information.",
                                available: false,
                            },
                            {
                                icon: "tools" as const,
                                title: "CLI & MCP tools",
                                text: "Tool execution will need scoped permissions, approvals and an audit trail.",
                                available: false,
                            },
                        ].map((tool) => (
                            <article className="jade-tool" key={tool.title}>
                                <div className="jade-tool__icon">
                                    <Icon name={tool.icon} />
                                </div>
                                <div>
                                    <h3>{tool.title}</h3>
                                    <p>{tool.text}</p>
                                </div>
                                <span
                                    className={
                                        "jade-chip" +
                                        (tool.available && state.mode === "demo" ? " jade-chip--demo" : "")
                                    }
                                >
                                    {tool.available && state.mode === "demo" ? "Demo ready" : "Not connected"}
                                </span>
                            </article>
                        ))}
                        <div className="jade-connection-settings">
                            <div>
                                <h3>Connection mode</h3>
                                <p>
                                    {state.mode === "demo"
                                        ? "Deterministic workflows run locally with synthetic data."
                                        : "No requests leave this prototype. Live tasks will show a clear connection error."}
                                </p>
                            </div>
                            <select
                                aria-label="Connection mode"
                                value={state.mode}
                                onChange={(event) => model.setMode(event.target.value as "demo" | "disconnected")}
                            >
                                <option value="demo">Demo · synthetic data</option>
                                <option value="disconnected">Live gateway · disconnected</option>
                            </select>
                        </div>
                        {state.mode === "demo" && (
                            <details className="jade-test-controls">
                                <summary>Demo test controls</summary>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={state.simulateFailure}
                                        onChange={(event) => model.setSimulateFailure(event.target.checked)}
                                    />
                                    Simulate a failure on the next task
                                </label>
                                <p>
                                    See how Jade surfaces an error and lets you retry. No network failure is required.
                                </p>
                                <div className="jade-clear-history">
                                    <p>
                                        Clear finished demo tasks for the selected Jade instance in this conversation.
                                    </p>
                                    <button
                                        type="button"
                                        className="jade-secondary"
                                        disabled={
                                            !state.tasks.some(
                                                (task) => task.status === "completed" || task.status === "failed",
                                            )
                                        }
                                        onClick={model.clearDemoHistory}
                                    >
                                        Clear finished demo tasks
                                    </button>
                                </div>
                            </details>
                        )}
                    </div>
                )}
                <footer className="jade-footer">
                    <span className="jade-brand-mark">✳</span>
                    <span>Jade works where your team works.</span>
                    <span>OmniChat · experimental workspace</span>
                </footer>
            </div>
        </section>
    );
}
