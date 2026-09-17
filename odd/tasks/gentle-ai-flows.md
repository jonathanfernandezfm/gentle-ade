# Feature: Gentle AI flows — skills in the composer, phase marks in history, project readiness

## Objective

Integrate the Gentle AI workflows (SDD phases, review flows, workflow skills) into the
day-to-day agent loop of Gentle ADE: pick a flow from the composer, see where a flow
started and finished in the thread history, and know when a repository still needs Gentle
AI initialization. Finish the rebrand with a rose app icon and a "Gentle AI" sidebar header.

## Problem / Why

The hub (`/gentle-ai`) configures Gentle AI, but the chat loop still knows nothing about it:
the user must remember `/gentle-sdd-new`, `$judgment-day`, and per-agent naming; the
timeline shows only raw tool calls; nothing tells the user a repo never ran `sdd-init`.

## Scope

1. Rose app icon (desktop, web favicons, mobile, marketing) and in-app mark; sidebar header
   reads "Gentle AI".
2. Composer flow picker: grouped dropdown (Organic, SDD, Review, Workflow) that changes the
   composer accent and placeholder, and on send turns the prompt into the right invocation
   for the selected provider (Claude `/gentle-sdd-*` or `/skill`, OpenCode `/sdd-*`, Codex
   `$skill`, prose fallback elsewhere). The user message carries `context.gentleAiFlow`.
3. Timeline marks: a start divider above a flow-tagged user message and a finish divider when
   that turn settles (with duration); `Skill` tool calls and Gentle sub-agent spawns
   (`sdd-*`, `jd-*`, `review-*`) are recognisably labelled. Mobile gets the start/finish
   dividers.
4. Project readiness: server reports whether `openspec/config.yaml` exists; the web derives
   `ready | partial | missing` from that plus the skill registry, shows a composer banner
   with a one-click path into the `sdd-init` flow, and a thread-header chip for the active
   SDD change.

## Constraints

- Contracts first (`packages/contracts/src/gentleAi.ts`, `composerContext.ts`); web, mobile
  and server follow the schema. No raw argv from the client.
- Slash invocations must be the first character of the prompt (Claude expands only a leading
  `/name` in the last text block; `applyClaudePromptEffortPrefix` already protects it).
- Skill/command availability comes from the provider workspace snapshot
  (`ServerProviderWorkspaceSnapshot.slashCommands/skills`) — never assume a skill exists.
- No continuously repainting animations. Composer accent is a static gradient border.
- Icon pipeline is Icon Composer/macOS; on Windows we rasterize with `sharp` from `scripts/`
  and hand-roll the ICO. Source of truth stays the `.icon` bundles' `text.svg`.
- TDD mode: off (no project TDD config). Runner: `pnpm --filter <pkg> exec vitest run <files>`.
- Artifacts in English. Conventional commits, no AI attribution lines. No repo-wide checks.

## Tasks

- [x] T1 Rose icon + mark + sidebar header (assets/**, apps/web/public, apps/marketing/public, apps/mobile/assets, GentleWordmark.tsx, SidebarChrome.tsx, scripts/export-rose-icons.ts).
- [x] T2 Contracts: `GentleAiFlowId/GentleAiFlowGroup/GENTLE_AI_FLOWS` catalog, `OrchestrationMessageContext.gentleAiFlow`, `GentleAiProjectStatus.openspecConfigPresent`, schema tests.
- [x] T3 Server: openspec config detection, Claude `Skill` tool call summary (`detail: "Skill: <name>"`) + tests. (Shared helper `buildGentleAiFlowInvocation` moved to T4.)
- [x] T4 Web composer: per-thread `gentleAiFlow` draft field, `GentleFlowPicker` (footer + compact menu), accent CSS, placeholder, submit transform + context marker, one-shot reset, readiness banner, header chip.
- [x] T5 Web timeline: `gentle-flow-start` / `gentle-flow-end` rows, Skill/agent recognition, tests.
- [x] T6 Mobile: start/finish dividers in ThreadFeed.
- [x] T7 Verification: targeted typecheck/lint/tests for touched packages; web + server build; docs/user/gentle-ai.md section.
- [x] T8 Commits (conventional, work-unit sized): 8a469179 branding, ae0b8ff2 contracts, 59070d5d server, 4a926f05 web composer, ed102c67 web timeline, 3b525764 mobile, plus the docs/ledger commit.

## Acceptance criteria

- Selecting "SDD · New change" and sending "auth refactor" on Claude sends `/gentle-sdd-new auth refactor`; on Codex with the skill installed sends `$sdd-init …` style mentions; on a provider without the skill sends the prose fallback. The stored user message carries `context.gentleAiFlow`.
- Composer border/accent visibly changes per group; Organic looks like today.
- Thread shows "SDD · New change started" above the message and "… finished · 4m 12s" after the turn settles; live turns show no finish mark.
- A git repo without `.atl/skill-registry.md` and `openspec/config.yaml` shows the readiness banner; its action puts the composer into the `sdd-init` flow.
- Rose icon in the window/taskbar (Windows build), favicons, splash, sidebar; sidebar reads "Gentle AI".

## Progress / Evidence

- T1 done: `scripts/export-rose-icons.ts` (`vp run icons:export:rose`, sharp from `scripts/`, reuses `scripts/lib/icon-export.ts#encodePngIco`) regenerated 45 files: `.icon` `text.svg` layers, `assets/prod/logo.svg`, every `BRAND_ASSET_PATHS` raster (ios/universal/macos 1024, windows + web ICOs, favicons 16/32, apple-touch 180), web + marketing public favicons, Android foreground/mark/background/splash/notification, widget `T3Mark.svg`. IHDR/ICO readback matched previous dimensions (ICO bad entries 0); alpha/safe-zone checks pass. `GentleWordmark` = simplified rose in `currentColor` with accent spiral; sidebar reads "Gentle AI". Coordinator viewed `black-ios-1024.png` and `favicon-32x32.png`: reads as a rose at both sizes. Scripts typecheck exit 0; lint/fmt clean. Note: `--macos-1024` files are generated here (not Icon Composer), acceptable for this fork.
- T2 done: contracts typecheck exit 0; `packages/contracts` gentleAi + composerContext tests 38/38.
- T3 done: `GentleAiService.getProjectStatus` probes `openspec/config.yaml` in both branches; `ClaudeAdapter.summarizeToolRequest` emits `detail: "Skill: <name>"` for the Claude `Skill` tool (`itemType` stays `dynamic_tool_call`, `payload.data.toolName === "Skill"`); Codex/OpenCode have no equivalent tool. Server typecheck exit 0; server suites (gentleAi, messageContext, Normalizer.attachments, ClaudeAdapter) 203/203; web gentle-ai suites 32/32; `vp lint` + `vp fmt` on touched files clean. `ProjectSection` shows a Readiness row.
- T4 done: `packages/shared/src/gentleAiFlow.ts` (`buildGentleAiFlowInvocation`, `resolveGentleAiFlowRoute`, 11 tests; subpath export `./gentleAiFlow`). Draft store `gentleAiFlow` + `setGentleAiFlow`, storage v9→v10. `GentleFlowPicker.tsx` (footer, `aria-label="Gentle AI flow"`, `data-gentle-flow-picker`, grouped Organic/SDD/Review/Workflow with per-provider "via /cmd | $skill | instructions" hints; hidden when the binary is not installed) + compact "Flow" menu group. Frame classes `gentle-flow-frame gentle-flow-frame--{sdd,review,workflow}` / `--gentle-flow-accent` in `index.css` (static masked border; ultrathink wins). Placeholder per flow; empty composer sendable when a flow is active. Main `onSend` path transforms text and stamps `context.gentleAiFlow`; one-shot flows reset to Organic; `/compact`, plan follow-ups and implement-in-new-thread stay organic. `GentleReadinessBanner.tsx` (`gentle-ai-readiness:<root>` / `gentle-ai-not-installed:<env>`, dismissals in `t3code:gentle-ai-banner-dismissals`; actions "Set up with SDD init" → selects `sdd-init`, "Open Gentle AI hub"); project-status query gated to primary env + binary + git repo; refreshed after an `sdd-init` turn settles. `GentleSddChip.tsx` in the header (`/gentle-ai#project`). Evidence: shared tests 11/11; web unit suites (draft store, gentleFlow.logic, composerProviderState, ChatView.logic, composerContextRecords) 364/364; typecheck exit 0; lint only pre-existing warnings; fmt clean.
- T7 done: typecheck exit 0 for contracts, shared, client-runtime, t3, web, mobile, scripts. Tests: contracts 450/450; shared 826 pass / 1 pre-existing Windows failure (`nodeRuntime` hard-link probe, file untouched); client-runtime 1526/1526; server touched suites 203/203; web unit (chat, gentle-ai, ChatView.logic, composerDraftStore, lib, session-logic) 1520/1520 in 98 files; mobile threads 308 pass / 2 pre-existing CRLF failures (`checkout-new-task-branch.test.ts`, untouched, `core.autocrlf=true`). `vp lint` on all 51 changed source files: 0 errors (warnings pre-existing; the two `ChatComposer.tsx` memo warnings at 4340/4609 are outside changed hunks); `vp fmt --check` clean. `@t3tools/web build` OK (dist CSS contains `gentle-flow-frame`); `t3 build:bundle` OK (`apps/server/dist/bin.mjs` 8.45 MB). `docs/user/gentle-ai.md` gained "Flows in the composer" and "Project readiness". Skipped: no in-browser pass (not requested; preview snapshot tool unreliable here); Windows desktop installer not rebuilt this session; mobile composer picker out of scope.
- T5 done: `apps/web/src/components/chat/gentleFlowMarks.ts` (9 tests) + `MessagesTimeline.logic.ts` rows `gentle-flow-start:<messageId>` / `gentle-flow-end:<messageId>` (end only when no turn of the flow is unsettled; a flow spans until the next user message; duration from latestTurn or message→last entry; outcome from latestTurn.state). Folded turn renders `start, user, fold, assistant, end`. Skill detection in `packages/client-runtime/src/work-log/presentation.ts` (`toolData.toolName === "Skill"` + `input.skill`, fallback `detail` `/^Skill\s*[:·]/`), label "Skill · <name>", `ToolGroupAction "skill"` ("Ran N skills", SparklesIcon); `session-logic.ts` copies `payload.data` into `toolData` for Skill calls. Gentle agent pill for roles `sdd-*` (sdd accent) / `jd-*`, `review-*` (review accent) in `agentSpawnSummary.ts` + `AgentSpawnRow`. Web typecheck exit 0; web chat/session suites 243/243; client-runtime work-log 404/404 + typecheck exit 0; lint/fmt clean. Mobile `case "skill"` already added by T6.
- T6 done: `apps/mobile/src/features/threads/gentleFlowMarks.ts` (`insertGentleFlowMarks`, 6 tests) woven into `ThreadFeed.tsx` beside the compaction divider; `ThreadFeedRow` alias in `pending-thread-feed.ts`; `thread-work-log.tsx` gained the `case "skill"` glyph the client-runtime change required. Mobile typecheck pass; `vp test run` threads suites 114/114; lint/fmt clean. Gaps: user messages persist with `turnId: null`, so the finish mark spans to the next user message; Skill/agent labelling not mirrored on mobile; `use-composer-drafts.ts` rebuilds context literals (would drop `gentleAiFlow` if mobile ever sets it).

## Next step

Pushed (5d11cee8..c7a681ff). Receipt-driven review not entered: with everything committed the workspace projection has base_tree == candidate_tree (nothing to freeze), and `review status --next-transition` first demands a provider-bound `gentle-ai.review-intended-untracked-selection/v1` JSON for the 56 Gradle-cache untracked paths whose exact schema is not exposed by the CLI help or the installed contract docs (a guessed shape is refused with `invalid_request`). A review of the pushed range needs a human-run `gentle-ai review start --base-ref 5d11cee8` decision. Follow-ups: in-browser pass of the picker/banner/marks, rebuild the Windows installer with the rose icon, mobile composer flow picker.
