# Jade workspace prototype

An additive Element Web module and a standalone local demo for OmniChat. This package preserves Element's messaging engine and uses its public extension API.

- `pnpm --filter @omnichat/jade-workspace dev` — standalone on http://127.0.0.1:3005
- `pnpm --filter @omnichat/jade-workspace build:standalone` — standalone assets in `dist/`
- `pnpm --filter @omnichat/jade-workspace build` — Element module in `lib/index.js`
- `pnpm --filter @omnichat/jade-workspace test:unit` — focused unit tests
- `pnpm --filter @omnichat/jade-workspace lint:types` — TypeScript check

Build the workspace support packages first, using the root prototype launcher and pinned Node/pnpm toolchain.

## What works

Room and agent scoped task histories; queued, running, completed, and failed states; failure/retry; synthetic sales and stock reports; CSV download and clipboard copy; separate demo and disconnected modes. History persists locally under `omnichat.jade.prototype.v1` and is capped at 100 tasks. Interrupted tasks become failed on reload instead of pretending to finish.

The standalone page is independent of Element login and never calls a Matrix homeserver. Both adapters make no network requests. Custom prompts return a labelled, fixed sample briefing; they are not sent to an LLM.

The Element module adds a Jade room-header button and an `@Jade` composer preview while retaining the original preview. Its CSS is inlined in the module. Point Element's `modules` configuration at the built JavaScript.

## Composer safety

Draft insertion requires a currently mounted composer with an exact matching room, target, thread root, reply event and relation type. Unmount, hash navigation, logout, account change, or a relation change invalidate its lease. A thread with no verified identity cannot share.

The prototype host patch supplies the actual composer target, optional reply ID, relation type and explicit thread root. When an older or unpatched host omits those fields, the module intentionally disables Add to message draft. Download/copy remain usable. No plaintext REST message fallback exists.

## Live gateway boundary

The typed `JadeAdapter` contract is ready for an authenticated, authorised LAN adapter. The disconnected implementation fails honestly and never invents a successful tool result. Actual OpenClaw, model calls, MCP/CLI execution, permissions, audit and real reports remain integration work.

## Licence

New code: Copyright 2026 Loki Ventures. AGPL-3.0-only. Upstream Element licences and copyright remain in the repository root.
