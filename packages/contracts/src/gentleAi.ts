/**
 * Contracts for the Gentle AI configuration hub.
 *
 * Gentle AI (https://github.com/Gentleman-Programming/gentle-ai) is a Go CLI
 * that installs and maintains agent configurations, skills, personas, and the
 * SDD/RDD workflow assets on a machine. Its own surface is a terminal TUI plus
 * a long list of flags; this domain models everything the GUI hub needs:
 *
 * - a static catalog (agents, components, skills, personas, presets) so both
 *   the server and the web client render the same choices without a CLI probe,
 * - the observable install state (binary, Engram, `~/.gentle-ai/state.json`),
 * - per-project state (review mode, SDD status, risk assessment, ODD tasks),
 * - a closed set of command requests the server is allowed to spawn, with a
 *   line-oriented event stream for the live console.
 *
 * The command requests are a closed union on purpose: the client never sends
 * raw argv, so a compromised or buggy client cannot turn the hub into a remote
 * shell. The server builds the argv itself from these options.
 *
 * @module gentleAi
 */
import * as Schema from "effect/Schema";
import { IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

// ── Catalog: agents ────────────────────────────────────────────

export const GentleAiAgentId = Schema.Literals([
  "claude-code",
  "opencode",
  "kilocode",
  "gemini-cli",
  "codex",
  "cursor",
  "vscode-copilot",
  "antigravity",
  "windsurf",
  "kimi",
  "qwen-code",
  "kiro-ide",
  "openclaw",
  "pi",
  "trae-ide",
  "hermes",
]);
export type GentleAiAgentId = typeof GentleAiAgentId.Type;

export interface GentleAiAgentDescriptor {
  readonly id: GentleAiAgentId;
  readonly name: string;
  /**
   * Where the agent keeps its user-level configuration, written with a `~`
   * prefix. Display only: the hub shows it so a user can find the files Gentle
   * AI manages. The CLI resolves the real location itself.
   */
  readonly configPath: string;
  readonly description: string;
}

export const GENTLE_AI_AGENTS: ReadonlyArray<GentleAiAgentDescriptor> = [
  {
    id: "claude-code",
    name: "Claude Code",
    configPath: "~/.claude",
    description: "Anthropic's terminal agent; the reference target for skills, SDD, and personas.",
  },
  {
    id: "opencode",
    name: "OpenCode",
    configPath: "~/.config/opencode",
    description: "Open-source terminal agent with its own provider profiles and subagent launcher.",
  },
  {
    id: "kilocode",
    name: "Kilo Code",
    configPath: "~/.kilocode",
    description: "VS Code extension agent configured through a user-level rules directory.",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    configPath: "~/.gemini",
    description: "Google's command-line agent driven by Gemini models.",
  },
  {
    id: "codex",
    name: "Codex CLI",
    configPath: "~/.codex",
    description: "OpenAI's command-line agent, configured through AGENTS.md and config.toml.",
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: "~/.cursor",
    description: "Cursor editor's agent, configured through user rules and skills.",
  },
  {
    id: "vscode-copilot",
    name: "VS Code Copilot",
    configPath: "~/.copilot",
    description: "GitHub Copilot in VS Code, configured through instruction and skill files.",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    configPath: "~/.gemini/antigravity-cli",
    description: "Google's Antigravity agent surface, sharing the Gemini configuration root.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configPath: "~/.codeium/windsurf",
    description: "Codeium's Windsurf editor agent and its global rules.",
  },
  {
    id: "kimi",
    name: "Kimi CLI",
    configPath: "~/.kimi",
    description: "Moonshot's Kimi command-line agent.",
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    configPath: "~/.qwen",
    description: "Alibaba's Qwen Code command-line agent.",
  },
  {
    id: "kiro-ide",
    name: "Kiro IDE",
    configPath: "~/.kiro",
    description: "AWS Kiro IDE, configured through steering documents and hooks.",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    configPath: "~/.openclaw",
    description: "OpenClaw agent runtime with a user-level configuration directory.",
  },
  {
    id: "pi",
    name: "Pi",
    configPath: "~/.pi/agent",
    description: "Pi agent runtime; hosts the gentle-pi relay used by the review lifecycle.",
  },
  {
    id: "trae-ide",
    name: "Trae IDE",
    configPath: "~/.trae",
    description: "ByteDance's Trae IDE agent and its global rules.",
  },
  {
    id: "hermes",
    name: "Hermes",
    configPath: "~/.hermes",
    description: "Hermes agent runtime with a user-level skills directory.",
  },
] as const;

// ── Catalog: components ────────────────────────────────────────

export const GentleAiComponentId = Schema.Literals([
  "engram",
  "sdd",
  "skills",
  "context7",
  "persona",
  "permissions",
  "gga",
  "theme",
  "claude-theme",
  "opencode-gentle-logo",
]);
export type GentleAiComponentId = typeof GentleAiComponentId.Type;

export interface GentleAiComponentDescriptor {
  readonly id: GentleAiComponentId;
  readonly name: string;
  readonly description: string;
}

export const GENTLE_AI_COMPONENTS: ReadonlyArray<GentleAiComponentDescriptor> = [
  {
    id: "engram",
    name: "Engram",
    description: "Persistent memory MCP server that survives sessions and compactions.",
  },
  {
    id: "sdd",
    name: "SDD",
    description: "Spec-Driven Development phases: explore, propose, spec, design, tasks, apply.",
  },
  {
    id: "skills",
    name: "Skills",
    description: "The Gentle AI skill library installed into each agent's skills directory.",
  },
  {
    id: "context7",
    name: "Context7",
    description: "Documentation MCP server for up-to-date library and framework references.",
  },
  {
    id: "persona",
    name: "Persona",
    description: "The Gentleman output style that sets tone and teaching voice.",
  },
  {
    id: "permissions",
    name: "Permissions",
    description: "Managed permission allowlist so routine tool calls stop prompting.",
  },
  {
    id: "gga",
    name: "GGA",
    description: "Gentleman Git Assistant: conventional commits and branch/PR helpers.",
  },
  {
    id: "theme",
    name: "Terminal theme",
    description: "Generic terminal colour theme shared across agent surfaces.",
  },
  {
    id: "claude-theme",
    name: "Claude Code theme",
    description: "Claude Code specific theme matching the Gentle AI palette.",
  },
  {
    id: "opencode-gentle-logo",
    name: "OpenCode logo",
    description: "Gentle AI splash logo for the OpenCode terminal UI.",
  },
] as const;

// ── Catalog: skills ────────────────────────────────────────────

export const GentleAiSkillId = Schema.Literals([
  "sdd-init",
  "sdd-apply",
  "sdd-verify",
  "sdd-explore",
  "sdd-research",
  "sdd-propose",
  "sdd-spec",
  "sdd-design",
  "sdd-tasks",
  "sdd-archive",
  "sdd-onboard",
  "go-testing",
  "gentle-ai-bench",
  "skill-creator",
  "skill-improver",
  "judgment-day",
  "branch-pr",
  "issue-creation",
  "skill-registry",
  "chained-pr",
  "cognitive-doc-design",
  "comment-writer",
  "work-unit-commits",
  "rdd-defect-workflow",
  "systemic-issue-triage",
]);
export type GentleAiSkillId = typeof GentleAiSkillId.Type;

export const GentleAiSkillCategory = Schema.Literals(["sdd", "testing", "workflow"]);
export type GentleAiSkillCategory = typeof GentleAiSkillCategory.Type;

export interface GentleAiSkillDescriptor {
  readonly id: GentleAiSkillId;
  readonly name: string;
  readonly category: GentleAiSkillCategory;
  readonly description: string;
}

export const GENTLE_AI_SKILLS: ReadonlyArray<GentleAiSkillDescriptor> = [
  {
    id: "sdd-init",
    name: "SDD init",
    category: "sdd",
    description: "Detect the project stack and bootstrap the SDD persistence backend.",
  },
  {
    id: "sdd-explore",
    name: "SDD explore",
    category: "sdd",
    description: "Investigate an idea against the real codebase before any artifact is written.",
  },
  {
    id: "sdd-research",
    name: "SDD research",
    category: "sdd",
    description: "Collect source-backed external evidence and disclose the gaps.",
  },
  {
    id: "sdd-propose",
    name: "SDD propose",
    category: "sdd",
    description: "Turn exploration into a change proposal with intent, scope, and approach.",
  },
  {
    id: "sdd-spec",
    name: "SDD spec",
    category: "sdd",
    description: "Write the delta requirements and scenarios for an approved proposal.",
  },
  {
    id: "sdd-design",
    name: "SDD design",
    category: "sdd",
    description: "Choose the architecture and record the technical design decisions.",
  },
  {
    id: "sdd-tasks",
    name: "SDD tasks",
    category: "sdd",
    description: "Slice spec and design into an ordered implementation checklist.",
  },
  {
    id: "sdd-apply",
    name: "SDD apply",
    category: "sdd",
    description: "Implement the tasks against the spec, following existing project patterns.",
  },
  {
    id: "sdd-verify",
    name: "SDD verify",
    category: "sdd",
    description: "Validate the implementation against spec, design, and tasks.",
  },
  {
    id: "sdd-archive",
    name: "SDD archive",
    category: "sdd",
    description: "Merge delta specs into the main specs and close the change cycle.",
  },
  {
    id: "sdd-onboard",
    name: "SDD onboard",
    category: "sdd",
    description: "Walk a newcomer through a full SDD cycle on their own codebase.",
  },
  {
    id: "go-testing",
    name: "Go testing",
    category: "testing",
    description: "Focused Go testing patterns: coverage, Bubbletea teatest, golden files.",
  },
  {
    id: "gentle-ai-bench",
    name: "Gentle AI bench",
    category: "testing",
    description: "Benchmark and measure agent workflows against repeatable scenarios.",
  },
  {
    id: "skill-creator",
    name: "Skill creator",
    category: "workflow",
    description: "Author new LLM-first skills with valid frontmatter and triggers.",
  },
  {
    id: "skill-improver",
    name: "Skill improver",
    category: "workflow",
    description: "Audit and upgrade existing skills for clarity and trigger accuracy.",
  },
  {
    id: "judgment-day",
    name: "Judgment day",
    category: "workflow",
    description: "Blind dual adversarial review with bounded fix and re-judgment rounds.",
  },
  {
    id: "branch-pr",
    name: "Branch and PR",
    category: "workflow",
    description: "Create branches and pull requests with consistent naming and descriptions.",
  },
  {
    id: "issue-creation",
    name: "Issue creation",
    category: "workflow",
    description: "Write actionable issues with reproduction, evidence, and scope.",
  },
  {
    id: "skill-registry",
    name: "Skill registry",
    category: "workflow",
    description: "Index the available skills by trigger and path into `.atl/skill-registry.md`.",
  },
  {
    id: "chained-pr",
    name: "Chained PR",
    category: "workflow",
    description: "Split an oversized change into chained pull requests that protect review focus.",
  },
  {
    id: "cognitive-doc-design",
    name: "Cognitive doc design",
    category: "workflow",
    description: "Write guides, READMEs, and RFCs that reduce the reader's cognitive load.",
  },
  {
    id: "comment-writer",
    name: "Comment writer",
    category: "workflow",
    description: "Write code comments that explain intent rather than restate the code.",
  },
  {
    id: "work-unit-commits",
    name: "Work unit commits",
    category: "workflow",
    description: "Plan commits as reviewable work units that keep tests and docs with the code.",
  },
  {
    id: "rdd-defect-workflow",
    name: "RDD defect workflow",
    category: "workflow",
    description:
      "File and track receipt-driven development defects with privacy-scrubbed evidence.",
  },
  {
    id: "systemic-issue-triage",
    name: "Systemic issue triage",
    category: "workflow",
    description: "Group recurring defects into causal classes instead of filing duplicates.",
  },
] as const;

// ── Catalog: persona, preset, modes ────────────────────────────

export const GentleAiPersonaId = Schema.Literals([
  "gentleman",
  "gentleman-neutral-artifacts",
  "neutral",
  "custom",
]);
export type GentleAiPersonaId = typeof GentleAiPersonaId.Type;

export interface GentleAiPersonaDescriptor {
  readonly id: GentleAiPersonaId;
  readonly label: string;
  readonly description: string;
}

export const GENTLE_AI_PERSONAS: ReadonlyArray<GentleAiPersonaDescriptor> = [
  {
    id: "gentleman",
    label: "Gentleman",
    description: "The full Gentleman voice in conversation and in generated artifacts.",
  },
  {
    id: "gentleman-neutral-artifacts",
    label: "Gentleman, neutral artifacts",
    description: "Gentleman voice in conversation, neutral professional register in artifacts.",
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Neutral professional register everywhere; no persona styling.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "A hand-written output style that Gentle AI installs but does not manage.",
  },
] as const;

export const GentleAiPresetId = Schema.Literals([
  "full-gentleman",
  "ecosystem-only",
  "minimal",
  "custom",
]);
export type GentleAiPresetId = typeof GentleAiPresetId.Type;

export interface GentleAiPresetDescriptor {
  readonly id: GentleAiPresetId;
  readonly label: string;
  readonly description: string;
  /**
   * Components the CLI resolves for this preset. Verified against
   * `gentle-ai install --preset <id> --dry-run` on 3.0.2. `custom` resolves to
   * nothing: the user's own selection is the whole answer.
   */
  readonly components: ReadonlyArray<GentleAiComponentId>;
}

export const GENTLE_AI_PRESETS: ReadonlyArray<GentleAiPresetDescriptor> = [
  {
    id: "full-gentleman",
    label: "Full Gentleman",
    description: "Everything Gentle AI manages, themes and permissions included.",
    components: [
      "engram",
      "sdd",
      "skills",
      "context7",
      "persona",
      "permissions",
      "gga",
      "claude-theme",
      "opencode-gentle-logo",
    ],
  },
  {
    id: "ecosystem-only",
    label: "Ecosystem only",
    description: "Workflow and memory without the cosmetic or permission components.",
    components: ["engram", "sdd", "skills", "context7", "persona", "gga"],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Persona and persistent memory; nothing else is installed.",
    components: ["persona", "engram"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Pick the components yourself; no preset is applied.",
    components: [],
  },
] as const;

export const GentleAiSddMode = Schema.Literals(["single", "multi"]);
export type GentleAiSddMode = typeof GentleAiSddMode.Type;

export const GentleAiScope = Schema.Literals(["global", "workspace"]);
export type GentleAiScope = typeof GentleAiScope.Type;

export const GentleAiChannel = Schema.Literals(["stable", "beta"]);
export type GentleAiChannel = typeof GentleAiChannel.Type;

export const GentleAiRddMode = Schema.Literals(["on", "off", "unknown"]);
export type GentleAiRddMode = typeof GentleAiRddMode.Type;

export const GentleAiPlatform = Schema.Literals(["win32", "darwin", "linux"]);
export type GentleAiPlatform = typeof GentleAiPlatform.Type;

// ── Installed state ────────────────────────────────────────────

export const GentleAiBinarySource = Schema.Literals(["path", "go-bin", "not-found"]);
export type GentleAiBinarySource = typeof GentleAiBinarySource.Type;

export const GentleAiBinaryStatus = Schema.Struct({
  installed: Schema.Boolean,
  path: Schema.NullOr(Schema.String),
  version: Schema.NullOr(Schema.String),
  source: GentleAiBinarySource,
  /** Copy-pasteable command that installs or repairs the binary on this host. */
  installHint: Schema.String,
});
export type GentleAiBinaryStatus = typeof GentleAiBinaryStatus.Type;

export const GentleAiEngramStatus = Schema.Struct({
  installed: Schema.Boolean,
  path: Schema.NullOr(Schema.String),
  version: Schema.NullOr(Schema.String),
});
export type GentleAiEngramStatus = typeof GentleAiEngramStatus.Type;

/**
 * Decoded view of `~/.gentle-ai/state.json`. The file is written by the Go CLI
 * in snake_case and grows new keys between releases, so the server decodes it
 * tolerantly: unknown agent/component/skill ids are dropped rather than failing
 * the whole read, and `claude_phase_assignments` (`phase -> { model }`) is
 * flattened to `phase -> model`. What reaches the client is this clean shape.
 */
export const GentleAiInstallState = Schema.Struct({
  installedAgents: Schema.Array(GentleAiAgentId),
  installedBinaryVersion: Schema.NullOr(Schema.String),
  components: Schema.Array(GentleAiComponentId),
  /** An empty array means "all default skills", not "no skills". */
  skills: Schema.Array(GentleAiSkillId),
  preset: Schema.NullOr(GentleAiPresetId),
  persona: Schema.NullOr(GentleAiPersonaId),
  sddMode: Schema.NullOr(GentleAiSddMode),
  strictTdd: Schema.Boolean,
  rddMode: GentleAiRddMode,
  rddModeRecordedAt: Schema.NullOr(Schema.String),
  lastUpdateCheck: Schema.NullOr(Schema.String),
  pendingSync: Schema.Boolean,
  /** Claude phase -> model alias, flattened from the nested `{ model }` values. */
  claudePhaseAssignments: Schema.Record(Schema.String, Schema.String),
  communityTools: Schema.Array(Schema.String),
  selectionConfigured: Schema.Boolean,
});
export type GentleAiInstallState = typeof GentleAiInstallState.Type;

export const GentleAiStatus = Schema.Struct({
  binary: GentleAiBinaryStatus,
  engram: GentleAiEngramStatus,
  /** `null` when the state file is absent or unreadable. */
  state: Schema.NullOr(GentleAiInstallState),
  stateFilePath: Schema.String,
  statePresent: Schema.Boolean,
  platform: GentleAiPlatform,
  /** Whether `go` is on PATH, which decides if the Windows install hint can run. */
  goAvailable: Schema.Boolean,
  checkedAt: IsoDateTime,
});
export type GentleAiStatus = typeof GentleAiStatus.Type;

// ── Doctor ─────────────────────────────────────────────────────

export const GentleAiDoctorStatus = Schema.Literals(["ok", "warn", "fail"]);
export type GentleAiDoctorStatus = typeof GentleAiDoctorStatus.Type;

export const GentleAiDoctorCheck = Schema.Struct({
  id: Schema.String,
  status: GentleAiDoctorStatus,
  detail: Schema.String,
});
export type GentleAiDoctorCheck = typeof GentleAiDoctorCheck.Type;

export const GentleAiDoctorSummary = Schema.Struct({
  passed: NonNegativeInt,
  failed: NonNegativeInt,
  warnings: NonNegativeInt,
});
export type GentleAiDoctorSummary = typeof GentleAiDoctorSummary.Type;

export const GentleAiDoctorReport = Schema.Struct({
  checks: Schema.Array(GentleAiDoctorCheck),
  summary: GentleAiDoctorSummary,
  healthy: Schema.Boolean,
  /** The unparsed output, so the hub can show exactly what the CLI printed. */
  raw: Schema.String,
});
export type GentleAiDoctorReport = typeof GentleAiDoctorReport.Type;

// ── Update check ───────────────────────────────────────────────

export const GentleAiUpdateStatus = Schema.Literals(["ok", "outdated", "missing"]);
export type GentleAiUpdateStatus = typeof GentleAiUpdateStatus.Type;

export const GentleAiUpdateEntry = Schema.Struct({
  tool: Schema.String,
  installed: Schema.NullOr(Schema.String),
  latest: Schema.NullOr(Schema.String),
  status: GentleAiUpdateStatus,
});
export type GentleAiUpdateEntry = typeof GentleAiUpdateEntry.Type;

export const GentleAiUpdateReport = Schema.Struct({
  entries: Schema.Array(GentleAiUpdateEntry),
  /** True when no entry is `outdated`; a `missing` optional tool stays up to date. */
  upToDate: Schema.Boolean,
  raw: Schema.String,
});
export type GentleAiUpdateReport = typeof GentleAiUpdateReport.Type;

// ── Per-project status ─────────────────────────────────────────

export const GentleAiReviewModeState = Schema.Struct({
  global: GentleAiRddMode,
  /** Empty string when the clone has no local override, matching the CLI's `clone_local`. */
  cloneLocal: Schema.String,
  effective: GentleAiRddMode,
  /** Which level decided the effective mode, e.g. `global` or `clone`. */
  source: Schema.String,
});
export type GentleAiReviewModeState = typeof GentleAiReviewModeState.Type;

export const GentleAiSddTaskProgress = Schema.Struct({
  total: NonNegativeInt,
  completed: NonNegativeInt,
  pending: NonNegativeInt,
  allComplete: Schema.Boolean,
});
export type GentleAiSddTaskProgress = typeof GentleAiSddTaskProgress.Type;

export const GentleAiSddStatus = Schema.Struct({
  changeName: Schema.NullOr(Schema.String),
  artifactStore: Schema.String,
  planningHomePath: Schema.String,
  /** Artifact name -> state, e.g. `{ proposal: "missing", tasks: "present" }`. */
  artifacts: Schema.Record(Schema.String, Schema.String),
  taskProgress: GentleAiSddTaskProgress,
});
export type GentleAiSddStatus = typeof GentleAiSddStatus.Type;

export const GentleAiRiskTier = Schema.Literals(["passive", "medium", "high"]);
export type GentleAiRiskTier = typeof GentleAiRiskTier.Type;

export const GentleAiRiskReason = Schema.Struct({
  code: Schema.String,
  path: Schema.optionalKey(Schema.String),
  detail: Schema.optionalKey(Schema.String),
});
export type GentleAiRiskReason = typeof GentleAiRiskReason.Type;

export const GentleAiRiskAssessment = Schema.Struct({
  risk: GentleAiRiskTier,
  reasons: Schema.Array(GentleAiRiskReason),
  changedPaths: NonNegativeInt,
  changedLines: NonNegativeInt,
});
export type GentleAiRiskAssessment = typeof GentleAiRiskAssessment.Type;

export const GentleAiOddTaskDocument = Schema.Struct({
  name: Schema.String,
  /** Repository-relative path, e.g. `odd/tasks/gentle-ai-ade.md`. */
  path: Schema.String,
  total: NonNegativeInt,
  completed: NonNegativeInt,
});
export type GentleAiOddTaskDocument = typeof GentleAiOddTaskDocument.Type;

export const GentleAiSkillRegistryState = Schema.Struct({
  present: Schema.Boolean,
  /** Repository-relative path, always reported so the hub can offer a refresh. */
  path: Schema.String,
  skillCount: Schema.NullOr(NonNegativeInt),
  updatedAt: Schema.NullOr(IsoDateTime),
});
export type GentleAiSkillRegistryState = typeof GentleAiSkillRegistryState.Type;

/**
 * Everything the hub shows for one workspace. Every sub-check is independent:
 * a failing CLI probe or unreadable file lands in `errors` and leaves the rest
 * of the panel populated, because a missing `openspec/` directory must not hide
 * the review mode beside it.
 */
export const GentleAiProjectStatus = Schema.Struct({
  workspaceRoot: Schema.String,
  isGitRepo: Schema.Boolean,
  reviewMode: Schema.NullOr(GentleAiReviewModeState),
  sddStatus: Schema.NullOr(GentleAiSddStatus),
  riskAssessment: Schema.NullOr(GentleAiRiskAssessment),
  /** Why the risk assessment is absent, e.g. no pending changes to assess. */
  riskAssessmentError: Schema.NullOr(Schema.String),
  oddTasks: Schema.Array(GentleAiOddTaskDocument),
  openspecChanges: Schema.Array(Schema.String),
  skillRegistry: GentleAiSkillRegistryState,
  engramPresent: Schema.Boolean,
  errors: Schema.Array(Schema.String),
});
export type GentleAiProjectStatus = typeof GentleAiProjectStatus.Type;

/** Payload for every per-workspace query in this domain. */
export const GentleAiWorkspaceInput = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
});
export type GentleAiWorkspaceInput = typeof GentleAiWorkspaceInput.Type;

// ── Command execution ──────────────────────────────────────────

export const GentleAiCommandKind = Schema.Literals([
  "install",
  "sync",
  "upgrade",
  "update-check",
  "doctor",
  "uninstall",
  "skill-registry-refresh",
  "install-binary",
  "review-mode",
]);
export type GentleAiCommandKind = typeof GentleAiCommandKind.Type;

export const GentleAiInstallOptions = Schema.Struct({
  agents: Schema.Array(GentleAiAgentId),
  components: Schema.Array(GentleAiComponentId),
  skills: Schema.Array(GentleAiSkillId),
  persona: GentleAiPersonaId,
  preset: GentleAiPresetId,
  sddMode: GentleAiSddMode,
  scope: GentleAiScope,
  channel: GentleAiChannel,
  dryRun: Schema.Boolean,
});
export type GentleAiInstallOptions = typeof GentleAiInstallOptions.Type;

export const GentleAiSyncOptions = Schema.Struct({
  agents: Schema.optionalKey(Schema.Array(GentleAiAgentId)),
  skills: Schema.optionalKey(Schema.Array(GentleAiSkillId)),
  sddMode: Schema.optionalKey(GentleAiSddMode),
  strictTdd: Schema.optionalKey(Schema.Boolean),
  includePermissions: Schema.optionalKey(Schema.Boolean),
  includeTheme: Schema.optionalKey(Schema.Boolean),
  dryRun: Schema.Boolean,
});
export type GentleAiSyncOptions = typeof GentleAiSyncOptions.Type;

export const GentleAiUninstallOptions = Schema.Struct({
  agents: Schema.optionalKey(Schema.Array(GentleAiAgentId)),
  all: Schema.optionalKey(Schema.Boolean),
});
export type GentleAiUninstallOptions = typeof GentleAiUninstallOptions.Type;

export const GentleAiReviewModeOptions = Schema.Struct({
  action: Schema.Literals(["enable", "disable"]),
  scope: Schema.Literals(["global", "clone"]),
  /** Required for clone scope; the CLI resolves the clone from this path. */
  cwd: Schema.optionalKey(TrimmedNonEmptyString),
});
export type GentleAiReviewModeOptions = typeof GentleAiReviewModeOptions.Type;

export const GentleAiSkillRegistryRefreshOptions = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
  force: Schema.optionalKey(Schema.Boolean),
});
export type GentleAiSkillRegistryRefreshOptions = typeof GentleAiSkillRegistryRefreshOptions.Type;

/**
 * The closed set of commands the hub may run. The server maps each variant to
 * a fixed argv shape; the client never supplies argv, flags, or a binary path.
 */
export const GentleAiRunRequest = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("install"), options: GentleAiInstallOptions }),
  Schema.Struct({ kind: Schema.Literal("sync"), options: GentleAiSyncOptions }),
  Schema.Struct({ kind: Schema.Literal("upgrade") }),
  Schema.Struct({ kind: Schema.Literal("update-check") }),
  Schema.Struct({ kind: Schema.Literal("doctor") }),
  Schema.Struct({ kind: Schema.Literal("uninstall"), options: GentleAiUninstallOptions }),
  Schema.Struct({
    kind: Schema.Literal("skill-registry-refresh"),
    options: GentleAiSkillRegistryRefreshOptions,
  }),
  Schema.Struct({ kind: Schema.Literal("install-binary") }),
  Schema.Struct({ kind: Schema.Literal("review-mode"), options: GentleAiReviewModeOptions }),
]);
export type GentleAiRunRequest = typeof GentleAiRunRequest.Type;

export const GentleAiCommandStream = Schema.Literals(["stdout", "stderr"]);
export type GentleAiCommandStream = typeof GentleAiCommandStream.Type;

/**
 * Console events for one command run. `started` carries the argv joined for
 * display; it never contains a secret, because every accepted argv shape is
 * built from the catalog above.
 */
export const GentleAiCommandEvent = Schema.Union([
  Schema.TaggedStruct("started", { command: Schema.String }),
  Schema.TaggedStruct("output", { stream: GentleAiCommandStream, line: Schema.String }),
  Schema.TaggedStruct("exited", { exitCode: Schema.Int, durationMs: NonNegativeInt }),
]);
export type GentleAiCommandEvent = typeof GentleAiCommandEvent.Type;

// ── Errors ─────────────────────────────────────────────────────

export class GentleAiBinaryNotFoundError extends Schema.TaggedError<GentleAiBinaryNotFoundError>()(
  "GentleAiBinaryNotFoundError",
  {
    /** Where the server looked, so the hub can explain the failure concretely. */
    searchedPaths: Schema.Array(Schema.String),
    installHint: Schema.String,
  },
) {
  override get message(): string {
    return `The gentle-ai binary was not found. Install it with: ${this.installHint}`;
  }
}

export class GentleAiCommandFailedError extends Schema.TaggedError<GentleAiCommandFailedError>()(
  "GentleAiCommandFailedError",
  {
    command: Schema.String,
    exitCode: Schema.NullOr(Schema.Int),
    stderr: Schema.String,
  },
) {
  override get message(): string {
    return `'${this.command}' failed with exit code ${this.exitCode ?? "unknown"}`;
  }
}

export class GentleAiStateParseError extends Schema.TaggedError<GentleAiStateParseError>()(
  "GentleAiStateParseError",
  {
    path: Schema.String,
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `Failed to read the Gentle AI state file at '${this.path}': ${this.reason}`;
  }
}

export const GentleAiError = Schema.Union([
  GentleAiBinaryNotFoundError,
  GentleAiCommandFailedError,
  GentleAiStateParseError,
]);
export type GentleAiError = typeof GentleAiError.Type;
