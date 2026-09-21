/*
Copyright 2026 Loki Ventures

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

/** Check deployed local wiring; browser interactions are recorded separately in VERIFICATION.md. */
async function main(): Promise<void> {
    const demo = await fetch("http://localhost:3005", { signal: AbortSignal.timeout(15000) });
    assert.equal(demo.status, 200);
    assert.match(await demo.text(), /src\/standalone\.tsx/);
    const client = await fetch("http://localhost:3010", { signal: AbortSignal.timeout(15000) });
    assert.equal(client.status, 200);
    const configResponse = await fetch("http://localhost:3010/config.json");
    assert.equal(configResponse.status, 200);
    const config = (await configResponse.json()) as {
        modules: string[];
        default_server_config: { "m.homeserver": { base_url: string } };
    };
    assert.equal(config.default_server_config["m.homeserver"].base_url, "http://127.0.0.1:8010");
    assert.ok(config.modules.includes("/jade/index.js"));
    const module = await fetch("http://localhost:3010/jade/index.js");
    assert.equal(module.status, 200);
    assert.match(module.headers.get("content-type") ?? "", /javascript/);
    assert.match(await module.text(), /Open Jade workspace/);
    const server = await fetch("http://127.0.0.1:8010/_matrix/client/versions");
    assert.equal(server.status, 200);
    const federation = await fetch("http://127.0.0.1:8010/_matrix/federation/v1/version");
    assert.equal(federation.status, 404);
    const result = {
        timestamp: new Date().toISOString(),
        passed: [
            "Jade dev entry on3005",
            "Element entry on3010",
            "Loopback homeserver configuration",
            "Runtime Jade module served as JavaScript",
            "Matrix client API responds",
            "Federation API not exposed",
        ],
        limitation: "HTTP wiring only. Interactive browser findings are recorded in VERIFICATION.md.",
    };
    await writeFile(new URL("./.state/workflow-verification.json", import.meta.url), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
}
void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
