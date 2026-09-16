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

## Doctor and updates

- **Run diagnostics** runs `gentle-ai doctor` and shows its plain-text output.
- **Check for updates** runs `gentle-ai update` (with `GENTLE_AI_NO_SELF_UPDATE=1` so it only
  reports what's available); **Upgrade** runs `gentle-ai upgrade`.
- **Uninstall** runs `gentle-ai uninstall` and clears the hub's cached status.

## Troubleshooting

If the hub shows "not installed," the server could not find the `gentle-ai` binary on `PATH` or at
`~/go/bin/gentle-ai(.exe)`. Install it (see the main [README](../../README.md#requirements)) and
reopen the hub; it re-detects the binary on the next status refresh.
