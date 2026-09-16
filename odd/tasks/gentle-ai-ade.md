# Feature: Gentle ADE — Gentle-AI configuration hub on top of T3 Code

## Objective

Turn the t3code fork into "Gentle ADE": an Agentic Development Environment that lets users
install, configure, and monitor gentle-ai (https://github.com/Gentleman-Programming/gentle-ai)
and all of its features (agents, components, skills, persona, SDD mode, RDD review mode,
Engram memory, model assignments) from a polished GUI instead of the terminal TUI.

## Problem / Why

gentle-ai is configured through a terminal TUI and a long list of CLI flags. Its state lives in
`~/.gentle-ai/state.json` and per-agent config dirs. There is no visual surface to see what is
installed, toggle features, or inspect per-project SDD/RDD/ODD state. T3 Code already provides
an agent control surface (web + desktop + server RPC), so building the hub on top of it gives
a complete ADE.

## Scope

- New `gentleAi` RPC domain (contracts + server service + ws handlers).
- New web hub page `/gentle-ai` with setup wizard, agents grid, feature toggles, skills catalog,
  persona/models, per-project status, live command console, docs links.
- New Settings section "Gentle AI" (summary + quick toggles + link to hub).
- Sidebar entry to open the hub.
- Light rebrand to "Gentle ADE" (title, branding default, desktop productName, README intro).
- Rose accent theme option matching gentle-ai brand (#F095C8 on #1A1218).

## Constraints

- Follow existing t3code patterns: Effect services/layers, `Rpc.make` contracts in
  `packages/contracts/src/rpc.ts`, handlers in `apps/server/src/ws.ts`, `@effect/atom-react`
  atoms + `useAtomCommand` on the web, TanStack file routes, Tailwind v4, lucide icons.
- gentle-ai CLI facts (v3.0.2):
  - binary: `gentle-ai` on PATH or `~/go/bin/gentle-ai(.exe)`; Windows install = `go install github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@latest`; mac/linux = `curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/install.sh | bash` (verify script path).
  - state: `~/.gentle-ai/state.json` (installed_agents, installed_binary_version, components, skills, preset, persona, sdd_mode, strict_tdd, rdd_mode, claude_phase_assignments, model_assignments, last_update_check, pending_sync...).
  - `install --agents a,b --components ... --skills ... --persona <gentleman|gentleman-neutral-artifacts|neutral|custom> --preset <full-gentleman|ecosystem-only|minimal|custom> --sdd-mode single|multi --scope global|workspace --channel stable|beta [--dry-run]` (non-interactive when all flags given).
  - `sync [--agents] [--skills] [--sdd-mode] [--strict-tdd] [--include-permissions] [--include-theme] [--profile name:provider/model] [--profile-phase name:phase:model] [--dry-run]`.
  - `doctor` (text), `update` (text, GENTLE_AI_NO_SELF_UPDATE=1), `upgrade`, `uninstall`.
  - `review mode status|enable|disable [--cwd] [--scope global|clone] [--json]` → gentle-ai.review-mode/v1.
  - `review assess --cwd <repo> --json` → gentle-ai.review-assessment/v1; dirty repos need `--untracked-scope=exclude --expected-untracked-inventory=sha256:...` (sha is in the error text).
  - `sdd-status [change] --cwd <repo> --json` → gentle-ai.sdd-status v2.
  - `skill-registry refresh [--cwd] [--force] [--quiet]` → `.atl/skill-registry.md`.
  - engram: `engram --version`, `engram doctor --json`, `engram serve [port=7437]`, `engram mcp`.
- Agents (16 ids): claude-code, opencode, kilocode, gemini-cli, codex, cursor, vscode-copilot, antigravity, windsurf, kimi, qwen-code, kiro-ide, openclaw, pi, trae-ide, hermes.
- Components: engram, sdd, skills, context7, persona, permissions, gga, theme, claude-theme, opencode-gentle-logo.
- Skills (25): sdd-init, sdd-apply, sdd-verify, sdd-explore, sdd-research, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-archive, sdd-onboard, go-testing, gentle-ai-bench, skill-creator, skill-improver, judgment-day, branch-pr, issue-creation, skill-registry, chained-pr, cognitive-doc-design, comment-writer, work-unit-commits, rdd-defect-workflow, systemic-issue-triage.
- TDD mode: off (no project TDD config; t3code uses vitest via `vp`). Runner: `pnpm test` / `vp test run`.
- Node 24.13.1 (portable at E:\development\tools\node-v24.13.1-win-x64), pnpm 11.10.0 via corepack.
- Artifacts in English. Conventional commits, no AI attribution lines.

## Tasks

- [x] T1 Toolchain: Node 24 + pnpm 11 + `pnpm install`; baseline `pnpm typecheck` for contracts/server/web passes.
- [x] T2 Contracts: `packages/contracts/src/gentleAi.ts` (catalog, status, project status, command stream schemas) + WS methods/Rpc in `rpc.ts` + schema tests.
- [x] T3 Server: `apps/server/src/gentleAi/` service (binary detection, state.json reader, doctor/update parsing, install/sync/upgrade/uninstall streaming runner, review mode set, sdd-status, assess with untracked fallback, skill registry refresh, engram status), ws handlers, layer wiring, vitest unit tests.
- [x] T4 Web: `apps/web/src/state/gentleAi.ts` atoms + hooks; hub route `/gentle-ai`; components under `apps/web/src/components/gentle-ai/`; settings section `settings.gentle-ai.tsx`; sidebar entry.
- [x] T5 Branding: "Gentle ADE" title/branding/productName; rose theme; README intro; docs/user/gentle-ai.md.
- [ ] T6 Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (server + contracts + web), `pnpm build` (web + server), Windows desktop artifact build.
- [ ] T7 Commits (conventional, work-unit sized).

## Acceptance criteria

- Hub renders status from real `~/.gentle-ai/state.json` and binary; shows not-installed state gracefully.
- Install/sync/upgrade run through the server with a live log stream and refresh status when done.
- RDD toggle, persona, preset, agents, components, skills selection map to real CLI flags.
- Per-project panel shows review mode, SDD status, ODD task docs, skill registry, engram presence.
- Typecheck, lint, tests, and build pass; a Windows desktop build artifact is produced.

## Progress / Evidence

- T1 done: portable Node 24.13.1 at E:\development\tools; `corepack pnpm install` exit 0 (prepare/effect-tsgo patch OK on Windows); `pnpm --filter ./apps/web typecheck` exit 0 (only effect schemaNumber suggestions). cargo present for the desktop resource-monitor build.
- T5 done: "T3 Code" → "Gentle ADE" in web/desktop product-facing defaults (legacy userData dir name, GNOME extension uuid, and WelcomeWizard wordmark intentionally left); `GENTLE_ROSE_THEME` (`gentle-rose`) added to shared BUILT_IN_THEMES via the OKLCH theme engine, exported from `apps/web/src/themePalette.ts`, boot splash updated; default theme unchanged (tangled with migration logic). README rewritten, `docs/user/gentle-ai.md` added and linked. Evidence: shared typecheck+test 816 pass; desktop typecheck pass; web typecheck pass; branding tests 8/8; theme tests 69/69; build-desktop-artifact tests 60/71 with 11 pre-existing Windows env failures (stray C:\Users\Jonathan\node_modules, tar exit code).

- T2+T3 done: `packages/contracts/src/gentleAi.ts` (+test), rpc.ts/index.ts wiring, `packages/client-runtime/src/rpc/client.ts` stream tag, `apps/server/src/gentleAi/{argv,parsers,state,GentleAiService}.ts` (+tests), ws.ts handlers, server.ts layer, RpcAuthorization scopes. RPC: gentleAiGetStatus, gentleAiGetProjectStatus, gentleAiRunDoctor, gentleAiCheckUpdates, gentleAiRunCommand (stream of started/output/exited), gentleAiSetReviewMode, gentleAiRefreshSkillRegistry. Evidence: contracts typecheck pass + 441/441 tests; server (`t3`) typecheck pass; gentleAi tests 43/43; full server suite 4792 pass / 23 pre-existing Windows env failures; `pnpm lint` exit 0; smoke-verified against real gentle-ai 3.0.2 (status, doctor, project status with untracked retry, streamed doctor).

- T4 done: `apps/web/src/state/gentleAi.ts` (query atom families for status/project status, RPC commands for doctor/update-check/review-mode/skill-registry, a single-flight streaming `gentleAiRunCommand` driving a keep-alive console atom, plus `useGentleAiStatus`/`useGentleAiProjectStatus`/`useGentleAiConsole`/`useGentleAiRunner`). Hub at `apps/web/src/components/gentle-ai/`: `gentleAi.logic.ts` (wizard reducer, preset resolution, display-only command composer mirroring `apps/server/src/gentleAi/argv.ts`, skill grouping/filtering, console line buffer capped at 2000 lines, phase-assignment ordering), `primitives.tsx`, `GentleAiHubPage.tsx` (hero with rose radial glow, sticky IntersectionObserver section nav with a live "Running…" pill), `OverviewSection`, `SetupWizard` (5-step keyboard-navigable tablist), `AgentsSection` (16 monogram tiles), `FeaturesSection` (RDD + strict-TDD switches, sync, uninstall alert dialog), `SkillsSection`, `PersonaModelsSection`, `ProjectSection`, `GentleAiConsole`, `DocsSection`, `GentleAiSettingsPanel`. Routes `routes/gentle-ai.tsx` + `routes/settings.gentle-ai.tsx`; registrations in `settingsSearch.ts` (SettingsPath, label, 4 search items), `SettingsSidebarNav.tsx` (SparklesIcon), `SidebarChrome.tsx` (rose-tinted utility entry + active-page match), `CommandPalette.tsx` ("Open Gentle AI hub"). Evidence: `pnpm --filter @t3tools/web typecheck` exit 0; `vitest run --project unit src/components/gentle-ai` 32/32 pass (29 logic + 3 hub render); `pnpm lint` exit 0; `pnpm --filter @t3tools/web build` built in 31s; settings/sidebar/palette suites 733 pass with 4 pre-existing locale failures in `Sidebar.snooze.test.ts` ("6:00 p. m." vs /PM/i). Dev server smoke: `/gentle-ai` and `/settings/gentle-ai` both serve 200 and the generated route tree contains both routes; the t3-code preview MCP automation tools (`preview_snapshot`/`preview_evaluate`/`preview_wait_for`) timed out against the dev tab, so no in-browser screenshot was captured.

## Next step

T6 verification (full monorepo typecheck/lint/test + Windows desktop artifact) and T7 commits. Optional follow-up: capture a real browser screenshot of `/gentle-ai` once preview automation works.
