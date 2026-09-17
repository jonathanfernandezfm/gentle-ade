# Gentle AI hub

The Gentle AI hub is where you install, configure, and monitor
[gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) without touching its terminal TUI.
Open it from the sidebar, or from **Settings → Gentle AI**.

gentle-ai's own state lives on disk at `~/.gentle-ai/state.json` (installed agents, components,
skills, preset, persona, SDD mode, RDD mode, model assignments, and update metadata). The hub reads
that file and the `gentle-ai` binary's own status output; it does not keep a separate copy of your
configuration.

## Sections

### Setup wizard

Walks through installing gentle-ai the first time: agents, components, skills, persona, preset,
and SDD mode. Finishing the wizard runs:

```
gentle-ai install --agents <a,b,...> --components <...> --skills <...> \
  --persona <persona> --preset <preset> --sdd-mode <single|multi> \
  --scope <global|workspace> --channel <stable|beta>
```

### Agents

Shows the 16 supported agent integrations (Claude Code, OpenCode, Kilocode, Gemini CLI, Codex,
Cursor, VS Code Copilot, Antigravity, Windsurf, Kimi, Qwen Code, Kiro IDE, OpenClaw, Pi, Trae IDE,
Hermes) and whether each is installed. Toggling agents here and applying the change runs
`gentle-ai sync --agents <selection>`.

### Features (components)

Toggles the optional components — Engram, SDD, skills, Context7, persona, permissions, GGA, theme,
Claude theme, and the OpenCode Gentle logo. Applying a change runs `gentle-ai sync` with the
matching flags (for example `--include-theme` or `--include-permissions`).

### Skills catalog

Lists the 25 bundled skills (sdd-init through systemic-issue-triage) and their install state.
"Refresh" runs `gentle-ai skill-registry refresh --cwd <project>`, which regenerates
`.atl/skill-registry.md` for the current project.

### Persona & models

Shows the active persona (`gentleman`, `gentleman-neutral-artifacts`, `neutral`, or `custom`) and
the current model/phase assignments. Saving changes runs
`gentle-ai sync --profile <name:provider/model>` and/or
`gentle-ai sync --profile-phase <name:phase:model>` per edited row.

### Per-project status

For the currently open project, shows:

- **RDD (review mode)** — read from `gentle-ai review mode status --cwd <project> --json`. The
  toggle in this panel calls `gentle-ai review mode enable --cwd <project>` or
  `gentle-ai review mode disable --cwd <project>`; the equivalent `--scope global` variants are
  available from the same control for turning RDD on or off for every project at once.
- **SDD status** — read from `gentle-ai sdd-status [change] --cwd <project> --json`.
- **Review risk** — on demand, from `gentle-ai review assess --cwd <project> --json` (dirty
  worktrees are retried with `--untracked-scope=exclude --expected-untracked-inventory=<sha256>`
  when the CLI reports one).
- **ODD task docs** — links to the project's `odd/tasks/*.md` files, when present.
- **Skill registry** — whether `.atl/skill-registry.md` exists and when it was last refreshed.
- **Engram** — whether `engram` is on `PATH` and whether `engram doctor --json` reports it healthy.

### Live console

Streams the stdout/stderr of whichever `gentle-ai` command is currently running (install, sync,
upgrade, uninstall, or `doctor`/`update`), and refreshes the panels above once the command exits.

## Flows in the composer

The composer has a **Gentle AI flow** picker next to the runtime-mode control (in the compact
composer it lives under the "…" menu as "Flow"). It puts the composer into one Gentle AI process
and turns whatever you type into the right invocation for the selected agent:

- **Organic** (default) sends your text unchanged.
- **SDD** flows (Initialize project, New change, Explore, Research, Fast-forward planning,
  Continue, Apply, Verify, Archive, Status, Onboard) send the matching command: `/gentle-sdd-*`
  on Claude Code, `/sdd-*` on OpenCode, `$skill` mentions on Codex.
- **Review** (Judgment Day) and **Workflow** flows (Chained PRs, Work-unit commits, Skill creator,
  Skill improver, Skill registry, Doc design, Go testing) send the skill by name.

The picker checks the agent's installed commands and skills for the current project and says
how each flow will be sent. When an agent has neither the command nor the skill, the flow is
sent as plain instructions naming the workflow instead of an unexpanded `/command`. A selected
flow tints the composer border (rose for SDD, amber for review, teal for workflow) and swaps the
placeholder; one-shot flows such as New change or Status return the composer to Organic after
sending, the others stay selected until you change them.

In the thread, every message sent from a flow gets a **started** mark above it and a
**finished** mark (with duration, or "stopped"/"failed") once the agent's turn settles. Claude's
`Skill` tool calls show as "Skill · <name>", and sub-agents Gentle AI spawns (`sdd-*`, `jd-*`,
`review-*` roles) carry a small "Gentle" tag.

## Project readiness

Gentle AI flows expect a repository that ran `sdd-init`: it writes `.atl/skill-registry.md` and
the `openspec/config.yaml` workspace. When either is missing in a git repository, the composer
shows a **Gentle AI isn't set up in this repository** banner. "Set up with SDD init" switches the
composer to the Initialize project flow so the next message runs it; "Open Gentle AI hub" jumps
to the per-project panel, which also lists the readiness state. Dismissing the banner hides it
for that repository only. When an active SDD change exists, the thread header shows an
`SDD · <change> · n/m tasks` chip that opens the same panel.

## Doctor and updates

- **Run diagnostics** runs `gentle-ai doctor` and shows its plain-text output.
- **Check for updates** runs `gentle-ai update` (with `GENTLE_AI_NO_SELF_UPDATE=1` so it only
  reports what's available); **Upgrade** runs `gentle-ai upgrade`.
- **Uninstall** runs `gentle-ai uninstall` and clears the hub's cached status.

## Troubleshooting

If the hub shows "not installed," the server could not find the `gentle-ai` binary on `PATH` or at
`~/go/bin/gentle-ai(.exe)`. Install it (see the main [README](../../README.md#requirements)) and
reopen the hub; it re-detects the binary on the next status refresh.
