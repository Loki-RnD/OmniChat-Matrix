/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, type JSX } from "react";
import { createRoot } from "react-dom/client";

import { DemoJadeAdapter, DisconnectedJadeAdapter, getDemoStorage } from "./adapter";
import { Icon } from "./icons";
import { JadeWorkspace } from "./workspace";
import "./workspace.css";

const adapters = { demo: new DemoJadeAdapter(getDemoStorage()), disconnected: new DisconnectedJadeAdapter() };
const rooms = [
    { id: "!demo-sales:local", name: "sales-operations" },
    { id: "!demo-warehouse:local", name: "warehouse" },
    { id: "!demo-leadership:local", name: "leadership" },
];

/** No Matrix login, homeserver, or remote data is needed for the demonstration. */
export function StandaloneApp(): JSX.Element {
    const [roomIndex, setRoomIndex] = useState(0);
    const room = rooms[roomIndex];
    return (
        <div className="jade-shell">
            <aside className="jade-sidebar" aria-label="Demo workspaces">
                <div className="jade-sidebar__top">
                    <div className="jade-logo">
                        <span className="jade-logo__mark">✳</span>OmniChat
                    </div>
                    <div className="jade-sidebar__prototype">Matrix prototype</div>
                </div>
                <div className="jade-sidebar__workspace">
                    <span>LV</span>
                    <div>
                        <strong>Loki Ventures</strong>
                        <small>Local demonstration workspace</small>
                    </div>
                </div>
                <a className="jade-open-chat" href="http://localhost:3010/" target="_blank" rel="noreferrer">
                    <Icon name="room" size={17} />
                    Open team chat
                    <Icon name="arrow" size={15} />
                </a>
                <span className="jade-sidebar__label">DEMO ROOMS</span>
                <nav aria-label="Demo rooms">
                    {rooms.map((item, index) => (
                        <button
                            type="button"
                            key={item.id}
                            className={"jade-room-button" + (index === roomIndex ? " is-active" : "")}
                            aria-current={index === roomIndex ? "page" : undefined}
                            onClick={() => setRoomIndex(index)}
                        >
                            <Icon name="room" size={16} />
                            {item.name}
                        </button>
                    ))}
                </nav>
                <div className="jade-sidebar__callout">
                    <Icon name="spark" size={23} />
                    <strong>Work, right in the room.</strong>
                    <p>An agent workspace for the conversations that move your business forward.</p>
                </div>
                <div className="jade-sidebar__footer">
                    <span className="jade-sidebar__avatar">DX</span>
                    <div>
                        <strong>Demo explorer</strong>
                        <small>Synthetic data only</small>
                    </div>
                </div>
            </aside>
            <JadeWorkspace
                key={room.id}
                context={{ roomId: room.id, target: "room" }}
                roomName={room.name}
                adapters={adapters}
                standalone
            />
        </div>
    );
}

const root = document.getElementById("root");
if (!root) throw new Error("The standalone root element is missing.");
createRoot(root).render(<StandaloneApp />);
