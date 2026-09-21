/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
async function main(): Promise<void> {
    const state = new URL("./.state/", import.meta.url);
    const accounts = JSON.parse(await readFile(new URL("accounts.json", state), "utf8"));
    const rooms = JSON.parse(await readFile(new URL("rooms.json", state), "utf8"));
    const base = "http://127.0.0.1:8010/_matrix/client/v3";
    const room = encodeURIComponent(rooms.verification);
    const stamp = Date.now();
    async function call<T = { event_id: string }>(
        path: string,
        token: string,
        body?: unknown,
        method = body ? "PUT" : "GET",
    ): Promise<T> {
        const response = await fetch(base + path, {
            method,
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const json = (await response.json()) as T;
        assert.ok(response.ok, path + ": " + JSON.stringify(json));
        return json;
    }
    const root = await call("/rooms/" + room + "/send/m.room.message/root" + stamp, accounts.alice.token, {
        msgtype: "m.text",
        body: "Synthetic transport check " + stamp,
    });
    const thread = await call("/rooms/" + room + "/send/m.room.message/thread" + stamp, accounts.bob.token, {
        "msgtype": "m.text",
        "body": "Synthetic thread reply",
        "m.relates_to": {
            "rel_type": "m.thread",
            "event_id": root.event_id,
            "is_falling_back": true,
            "m.in_reply_to": { event_id: root.event_id },
        },
    });
    const reaction = await call("/rooms/" + room + "/send/m.reaction/reaction" + stamp, accounts.bob.token, {
        "m.relates_to": { rel_type: "m.annotation", event_id: root.event_id, key: "✅" },
    });
    await call("/rooms/" + room + "/state/m.room.pinned_events/", accounts.alice.token, { pinned: [root.event_id] });
    const edit = await call("/rooms/" + room + "/send/m.room.message/edit" + stamp, accounts.alice.token, {
        "msgtype": "m.text",
        "body": "* Synthetic edited check",
        "m.new_content": { msgtype: "m.text", body: "Synthetic edited check" },
        "m.relates_to": { rel_type: "m.replace", event_id: root.event_id },
    });
    for (const event of [root, thread, reaction, edit]) {
        const saved = await call("/rooms/" + room + "/event/" + encodeURIComponent(event.event_id), accounts.bob.token);
        assert.equal(saved.event_id, event.event_id);
    }
    const sync = await call<{ rooms: { join: Record<string, unknown> } }>("/sync?timeout=0", accounts.bob.token);
    assert.ok(sync.rooms.join[rooms.verification]);
    const encrypted = await call<{ algorithm: string }>(
        "/rooms/" + encodeURIComponent(rooms.loki) + "/state/m.room.encryption/",
        accounts.alice.token,
    );
    assert.equal(encrypted.algorithm, "m.megolm.v1.aes-sha2");
    const result = {
        timestamp: new Date().toISOString(),
        passed: [
            "Two independent account sessions",
            "Persisted message fetched by second user",
            "Thread relation",
            "Reaction event",
            "Pinned state",
            "Edit event",
            "Second-user sync",
            "Loki room encryption configured",
        ],
        limitation:
            "Transport checks use a synthetic unencrypted test room. Browser encryption must be tested separately.",
    };
    await writeFile(new URL("baseline-verification.json", state), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
}
void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
