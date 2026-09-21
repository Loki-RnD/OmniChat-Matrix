/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

async function main(): Promise<void> {
    const state = new URL("./.state/", import.meta.url);
    const configUrl = new URL("synapse/homeserver.yaml", state);
    const server = "http://127.0.0.1:8010";
    const action = process.argv[2] ?? "seed";

    async function request<T = Record<string, unknown>>(
        path: string,
        body?: unknown,
        token?: string,
        method = body ? "POST" : "GET",
    ): Promise<T> {
        const response = await fetch(server + path, {
            method,
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(path + ": " + (result.error ?? response.status));
        return result as T;
    }
    const config = YAML.parse(await readFile(configUrl, "utf8"));
    if (action === "configure") {
        config.public_baseurl = server + "/";
        config.enable_registration = false;
        config.federation_domain_whitelist = [];
        config.trusted_key_servers = [];
        config.suppress_key_server_warning = true;
        config.listeners = [
            {
                port: 8008,
                tls: false,
                type: "http",
                x_forwarded: false,
                resources: [{ names: ["client"], compress: false }],
            },
        ];
        config.rc_message = { per_second: 10, burst_count: 100 };
        config.rc_registration = { per_second: 1, burst_count: 10 };
        config.rc_login = { address: { per_second: 1, burst_count: 20 }, account: { per_second: 1, burst_count: 20 } };
        await writeFile(configUrl, YAML.stringify(config));
        console.log("Configured isolated loopback Matrix server; federation and public registration are disabled.");
    } else {
        await mkdir(state, { recursive: true });
        const accountsUrl = new URL("accounts.json", state);
        let accounts: Record<string, { username: string; password: string; userId?: string; token?: string }>;
        try {
            accounts = JSON.parse(await readFile(accountsUrl, "utf8"));
        } catch {
            accounts = Object.fromEntries(
                ["alice", "bob"].map((username) => [
                    username,
                    { username, password: randomBytes(18).toString("base64url") },
                ]),
            );
        }
        // Persist passwords before registration so an interrupted first run remains recoverable.
        await writeFile(accountsUrl, JSON.stringify(accounts, null, 2));
        for (const account of Object.values(accounts)) {
            try {
                const { nonce } = await request<{ nonce: string }>("/_synapse/admin/v1/register");
                const mac = createHmac("sha1", config.registration_shared_secret)
                    .update([nonce, account.username, account.password, "notadmin"].join("\0"))
                    .digest("hex");
                await request("/_synapse/admin/v1/register", {
                    nonce,
                    username: account.username,
                    password: account.password,
                    admin: false,
                    mac,
                    displayname: account.username === "alice" ? "Alex · Demo" : "Sam · Demo",
                });
            } catch (error) {
                if (!(error instanceof Error) || !error.message.includes("already")) throw error;
            }
            const login = await request<{ access_token: string; user_id: string }>("/_matrix/client/v3/login", {
                type: "m.login.password",
                identifier: { type: "m.id.user", user: account.username },
                password: account.password,
                initial_device_display_name: "OmniChat prototype setup",
                device_id: "OMNICHAT_SETUP_" + account.username.toUpperCase(),
            });
            account.token = login.access_token;
            account.userId = login.user_id;
        }
        await writeFile(accountsUrl, JSON.stringify(accounts, null, 2));
        const roomsUrl = new URL("rooms.json", state);
        let rooms: Record<string, string> = {};
        try {
            rooms = JSON.parse(await readFile(roomsUrl, "utf8"));
        } catch {}
        for (const [key, name, encrypted] of [
            ["loki", "Loki · General", true],
            ["psk", "PSK · Operations", true],
            ["verification", "Prototype transport checks (synthetic)", false],
        ] as const) {
            if (!rooms[key]) {
                const result = await request<{ room_id: string }>(
                    "/_matrix/client/v3/createRoom",
                    {
                        name,
                        topic: encrypted
                            ? "OmniChat Matrix prototype · synthetic data only"
                            : "Synthetic API verification only. Unencrypted.",
                        visibility: "private",
                        preset: "private_chat",
                        invite: [accounts.bob.userId],
                        creation_content: { "m.federate": false },
                        initial_state: encrypted
                            ? [
                                  {
                                      type: "m.room.encryption",
                                      state_key: "",
                                      content: { algorithm: "m.megolm.v1.aes-sha2" },
                                  },
                              ]
                            : [],
                    },
                    accounts.alice.token,
                );
                rooms[key] = result.room_id;
                await writeFile(roomsUrl, JSON.stringify(rooms, null, 2));
            }
            await request("/_matrix/client/v3/join/" + encodeURIComponent(rooms[key]), {}, accounts.bob.token);
        }
        console.log("Two synthetic accounts and three private rooms are ready.");
        console.log("Local credentials: " + fileURLToPath(accountsUrl));
        console.log("Loki room: http://localhost:3010/#/room/" + rooms.loki);
    }
}
void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
