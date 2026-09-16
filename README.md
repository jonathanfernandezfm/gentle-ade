# Gentle ADE

Gentle ADE is an Agentic Development Environment: it puts [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) — Engram persistent memory, the ODD/SDD workflows, RDD review receipts, 16 coding-agent integrations, and its skill library — behind a real GUI instead of a terminal TUI. It's built on top of [T3 Code](#upstream-t3-code), so you also get a full agent control surface (web, desktop, and mobile) for free.

## What's inside

- **Gentle AI hub** at `/gentle-ai`: a setup wizard, the agents grid, feature/component toggles, the skills catalog, persona and model assignment, per-project SDD/RDD/ODD status, and a live command console that streams `gentle-ai` CLI output.
- **Settings → Gentle AI**: a summary panel, quick toggles (persona, RDD review mode, SDD mode), and a link into the hub.
- **Everything T3 Code already does**: agent sessions over web, desktop, and mobile; remote access; source control integrations; snapshots; and the rest of the surfaces documented below.
- A **Gentle Rose** accent theme (dark by default, with a light variant) matching the gentle-ai brand.

## Requirements

- The `gentle-ai` binary, reachable on `PATH` or at `~/go/bin/gentle-ai(.exe)`:
  - **Windows**: `go install github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@latest`
  - **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash`
- **Node 24** and **pnpm 11** (via corepack) for development.

## Development

```bash
pnpm install
pnpm dev             # run web + server (+ desktop shell) locally
pnpm build           # build the apps
pnpm dist:desktop:win  # produce a Windows desktop artifact
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/internals/overview.md](./docs/internals/overview.md) for the full contributor workflow, and [docs/user/gentle-ai.md](./docs/user/gentle-ai.md) for a tour of the Gentle AI hub.

## Upstream: T3 Code

Gentle ADE is a fork of [T3 Code](https://github.com/pingdotgg/t3code), an "agent harness control surface" that lets you control the coding agents on your machine from a mobile app ([iOS](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824), [Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code)), web app, and Electron-based desktop app. All credit for that foundation goes to the T3 Code team and contributors.

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, and Google Antigravity. If they're set up on your computer, the agent control surface can drive them.

### Documentation

Full docs live in [docs/](./docs).

- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run T3 Code as a background service](./docs/user/background-service.md)
- [Gentle AI hub](./docs/user/gentle-ai.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

### License and licenses

See [docs/user/open-source-licenses.md](./docs/user/open-source-licenses.md) for third-party notices.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.
