/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useLayoutEffect, useRef, type JSX, type ReactNode } from "react";
import type {
    Api,
    CustomComposerPreviewComponentProps,
    DialogProps,
    Module,
    ModuleFactory,
} from "@element-hq/element-web-module-api";

import { DemoJadeAdapter, DisconnectedJadeAdapter, getDemoStorage } from "./adapter";
import type { ComposerShareTarget, ConversationContext, JadeAdapter } from "./contracts";
import { ComposerContextRegistry } from "./composer-context";
import { Icon } from "./icons";
import { JadeWorkspace } from "./workspace";
import stylesheet from "./workspace.css?inline";

interface DialogBodyProps {
    context: ConversationContext;
    roomName: string;
    adapters: { demo: JadeAdapter; disconnected: JadeAdapter };
    shareTarget: ComposerShareTarget;
    initialPrompt: string;
}

function JadeDialog(props: DialogBodyProps & DialogProps<void>): JSX.Element {
    return (
        <div className="jade-dialog">
            <JadeWorkspace {...props} onClose={props.onCancel} />
        </div>
    );
}

interface ComposerEntryProps {
    composer: CustomComposerPreviewComponentProps;
    registry: ComposerContextRegistry;
    children: ReactNode;
    open: (context: ConversationContext, prompt: string) => void;
}

function ComposerEntry({ composer, registry, children, open }: ComposerEntryProps): JSX.Element {
    const token = useRef(Symbol("jade-composer"));
    const context: ConversationContext = {
        roomId: composer.roomId,
        target: composer.target?.view ?? "room",
        inReplyToEventId: composer.relation?.inReplyToEventId,
        threadRootId: composer.relation?.threadRootId,
        relationType: composer.relation?.relType,
    };
    useLayoutEffect(() => {
        const leaseToken = token.current;
        // Older host wrappers omit target/relation. Such composers cannot establish a safe sharing target.
        registry.record(leaseToken, composer.target ? context : null);
        return () => registry.release(leaseToken);
    });
    const addressed = /(^|\s)@jade\b/i.test(composer.text);
    return (
        <>
            {children}
            {addressed && (
                <div className="jade-module-preview">
                    <span>
                        <Icon name="spark" size={17} />
                        Prepare a task with Jade · synthetic demo
                    </span>
                    <button
                        type="button"
                        className="jade-module-entry"
                        onClick={() => open(context, composer.text.replace(/@jade\b/gi, "").trim())}
                    >
                        Open workspace
                        <Icon name="arrow" size={14} />
                    </button>
                </div>
            )}
        </>
    );
}

/** Additive room workspace. Native Element messaging and encryption remain unchanged. */
export class JadeWorkspaceModule implements Module {
    public static readonly moduleApiVersion = "^2.1.0";
    private readonly registry: ComposerContextRegistry;
    private readonly adapters = {
        demo: new DemoJadeAdapter(getDemoStorage()),
        disconnected: new DisconnectedJadeAdapter(),
    };

    public constructor(private readonly api: Api) {
        this.registry = new ComposerContextRegistry(
            () => api.profile.value.userId,
            () => window.location.hash,
        );
    }

    public async load(): Promise<void> {
        if (!document.getElementById("omnichat-jade-styles")) {
            const style = document.createElement("style");
            style.id = "omnichat-jade-styles";
            style.textContent = stylesheet;
            document.head.append(style);
        }
        window.addEventListener("hashchange", () => this.registry.invalidate());
        this.api.profile.watch(() => this.registry.invalidate());
        this.api.extras.addRoomHeaderButtonCallback((roomId) => (
            <button
                type="button"
                className="jade-module-entry"
                aria-label="Open Jade workspace"
                title="Open Jade workspace"
                onClick={() => this.open({ roomId, target: "room" }, "")}
            >
                <Icon name="spark" size={16} />
                Jade
            </button>
        ));
        this.api.customComponents.registerComposerPreview(
            () => true,
            (props, OriginalComponent) => (
                <ComposerEntry composer={props} registry={this.registry} open={this.open}>
                    <OriginalComponent {...props} />
                </ComposerEntry>
            ),
        );
    }

    private open = (context: ConversationContext, initialPrompt: string): void => {
        const userId = this.api.profile.value.userId;
        if (!userId) return;
        const shareTarget: ComposerShareTarget = {
            getCurrentContext: () => {
                if (this.api.profile.value.userId !== userId || !this.api.client.getRoom(context.roomId)) return null;
                return this.registry.current(context);
            },
            insert: (text, target) => this.api.composer.insertPlaintextIntoComposer(text, target),
        };
        this.api.openDialog<void, DialogBodyProps>({ title: "Jade workspace" }, JadeDialog, {
            context: { ...context },
            roomName: this.api.client.getRoom(context.roomId)?.name.value ?? "Current room",
            adapters: this.adapters,
            shareTarget,
            initialPrompt,
        });
    };
}

// The Element loader requires its ModuleFactory as the module's default export.
export default JadeWorkspaceModule satisfies ModuleFactory;
