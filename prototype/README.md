# OmniChat Matrix prototype

A separate Element Web fork for exploring an AI workspace inside team chat.

- **Jade workspace:** http://localhost:3005
- **Team chat:** http://localhost:3010
- **Local Matrix server:** http://127.0.0.1:8010
- **Fork:** https://github.com/Loki-RnD/OmniChat-Matrix
- **Branch:** `prototype/jade-workspace`
- **Element base:** `e7d6fd6473b2160b691317cc8ecff7022038da9e` (app version 1.12.28).
- **Synapse:** 1.161.0. Image digest `sha256:6b95dd129e35e97e8032cb759e5db4a516a5f7ef6c98d34d716fea1ae239b62a`.

This checkout is separate from the original OmniChat app. It uses its own dependencies, ports, local server and storage. It does not connect to the company databases, VPS or OpenClaw.

## Try it

Open port 3005 and select Weekly sales review or Check stock availability. Follow the task, open the report, and download its CSV. Room and Jade instance switches isolate the history. Tools shows the planned integrations and their actual disconnected state. Its test controls let you simulate a failure and retry.

Open port 3010 for real Matrix chat. The local synthetic users are `alice` and `bob`. Their generated passwords are stored in **prototype/.state/accounts.json**, excluded from Git. Use the username and password fields at sign-in. For two independent sessions in the same browser, use `localhost:3010` for Alice and `127.0.0.1:3010` for Bob.

The server seeds two encrypted private rooms, **Loki · General** and **PSK · Operations**, plus an explicitly unencrypted room for synthetic transport checks. Open **Jade** in a room header, or type `@Jade` in a composer to prepare a task with reply/thread context. A report is inserted into the matching native message draft for review before you send it.

## Start on Windows

Requires Git for Windows, Docker Desktop's Linux engine, and npm. From this repository:

```powershell
npm install --prefix prototype/toolchain --no-save node@22.18.0 pnpm@11.23.0
$env:PATH = "$PWD/prototype/toolchain/node_modules/node/bin;$PWD/prototype/toolchain/node_modules/.bin;" + $env:PATH
& ./prototype/toolchain/node_modules/node/bin/node.exe ./prototype/toolchain/node_modules/pnpm/bin/pnpm.cjs install --frozen-lockfile
./prototype/launch.ps1 -Mode All
```

The locally installed toolchain avoids changing another project's Node version. Initial dependencies and the chat compilation take a few minutes.

Launch only the workspace with `./prototype/launch.ps1 -Mode Demo`. Use `-Mode Matrix` for the server or `-Mode Chat` for the chat client. `-SkipBuild` reuses already-built packages. Logs are in `prototype/logs/`. The launcher never kills an occupied port.

Stop owned services with `./prototype/stop.ps1`. Matrix data remains in `prototype/.state/synapse/`; do not delete that directory if you want to retain these test accounts, rooms and keys.

## What is real and what is simulated

| Capability | Status |
| --- | --- |
| Matrix accounts, private rooms and message persistence | Real local Synapse |
| Element messaging, threads, reactions and encryption | Reused upstream implementation; see VERIFICATION.md for exercised paths |
| Jade tasks, reports, history, retry and CSV exports | Functional local demo, synthetic data |
| LLM answers, OpenClaw, company databases, MCP and CLI commands | Not connected |
| Adding a report to a message draft | Native Element composer with exact room/thread/reply checks |
| Calls, push notifications, federation, production deployment | Not configured or validated here |

Custom prompts return a labelled sample briefing, not an LLM response. No demo tool claims a real connection. The adapter boundary lives in `modules/jade-workspace/src/contracts.ts`.

## Moving toward a pilot

Keep the Element fork small: the Jade module and one host-context plumbing patch. The next integration is an authenticated gateway adapter with server-side room membership and agent/tool authorization. Confirm the OpenClaw job envelope with its owners, then add a Matrix bot/device or a reviewed task service that can receive authorized room context and return results.

A browser-local demo history is not shared team task storage. Production needs durable tasks, audit records, cancellation, real report authorization, retention and backup policies. Calls require a separate MatrixRTC deployment. Do not point these loopback demo settings at a public server.

Preserve Element's licence and copyright notices. New Jade module code is AGPL-3.0-only, copyright Loki Ventures. See the repository root licences and the module README.
