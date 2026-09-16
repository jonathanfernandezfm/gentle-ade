/**
 * Pure logic for the Gentle AI hub.
 *
 * Everything in here is framework-free on purpose: the wizard reducer, the
 * preset resolution, the display-only command composer, the skill catalog
 * filtering, and the console line buffer are the parts worth unit testing, so
 * they live away from the React tree that renders them.
 *
 * The command composer never reaches the server. `apps/server` owns argv (see
 * `apps/server/src/gentleAi/argv.ts`); this mirror exists so the review step of
 * the wizard can show the user exactly what is about to run.
 *
 * @module components/gentle-ai/gentleAi.logic
 */
import {
  GENTLE_AI_COMPONENTS,
  GENTLE_AI_PRESETS,
  GENTLE_AI_SKILLS,
  type GentleAiAgentId,
  type GentleAiChannel,
  type GentleAiCommandEvent,
  type GentleAiCommandKind,
  type GentleAiCommandStream,
  type GentleAiComponentId,
  type GentleAiInstallState,
  type GentleAiPersonaId,
  type GentleAiPresetId,
  type GentleAiRunRequest,
  type GentleAiScope,
  type GentleAiSddMode,
  type GentleAiSkillCategory,
  type GentleAiSkillDescriptor,
  type GentleAiSkillId,
} from "@t3tools/contracts";

// ── Presets and components ─────────────────────────────────────

/**
 * The components a preset implies. `custom` resolves to nothing: the user's own
 * checklist is the whole answer, so returning a default there would silently
 * overwrite a deliberate selection.
 */
export function resolvePresetComponents(
  preset: GentleAiPresetId,
): ReadonlyArray<GentleAiComponentId> {
  return GENTLE_AI_PRESETS.find((candidate) => candidate.id === preset)?.components ?? [];
}

/** Components in catalog order, so a rebuilt selection never reshuffles the list. */
export function sortComponents(
  components: ReadonlyArray<GentleAiComponentId>,
): ReadonlyArray<GentleAiComponentId> {
  const selected = new Set(components);
  return GENTLE_AI_COMPONENTS.filter((component) => selected.has(component.id)).map(
    (component) => component.id,
  );
}

/**
 * Which preset a component selection corresponds to, or `custom` when it
 * matches none. Used to keep the preset radio honest after a free selection.
 */
export function inferPreset(components: ReadonlyArray<GentleAiComponentId>): GentleAiPresetId {
  const selected = new Set(components);
  const match = GENTLE_AI_PRESETS.find(
    (preset) =>
      preset.id !== "custom" &&
      preset.components.length === selected.size &&
      preset.components.every((component) => selected.has(component)),
  );
  return match?.id ?? "custom";
}

// ── Skills ─────────────────────────────────────────────────────

export interface GentleAiSkillGroup {
  readonly category: GentleAiSkillCategory;
  readonly label: string;
  readonly skills: ReadonlyArray<GentleAiSkillDescriptor>;
}

export const GENTLE_AI_SKILL_CATEGORY_LABELS: Readonly<Record<GentleAiSkillCategory, string>> = {
  sdd: "Spec-Driven Development",
  testing: "Testing",
  workflow: "Workflow",
};

const SKILL_CATEGORY_ORDER: ReadonlyArray<GentleAiSkillCategory> = ["sdd", "testing", "workflow"];

/** Catalog skills matching a free-text query, in catalog order. */
export function filterSkills(
  query: string,
  category: GentleAiSkillCategory | "all" = "all",
  skills: ReadonlyArray<GentleAiSkillDescriptor> = GENTLE_AI_SKILLS,
): ReadonlyArray<GentleAiSkillDescriptor> {
  const normalized = query.trim().toLowerCase();
  return skills.filter((skill) => {
    if (category !== "all" && skill.category !== category) return false;
    if (normalized.length === 0) return true;
    return (
      skill.id.includes(normalized) ||
      skill.name.toLowerCase().includes(normalized) ||
      skill.description.toLowerCase().includes(normalized)
    );
  });
}

/** Skills grouped by category, dropping groups a filter emptied. */
export function groupSkills(
  skills: ReadonlyArray<GentleAiSkillDescriptor> = GENTLE_AI_SKILLS,
): ReadonlyArray<GentleAiSkillGroup> {
  return SKILL_CATEGORY_ORDER.flatMap((category) => {
    const members = skills.filter((skill) => skill.category === category);
    return members.length === 0
      ? []
      : [
          {
            category,
            label: GENTLE_AI_SKILL_CATEGORY_LABELS[category],
            skills: members,
          },
        ];
  });
}

/** Skills in catalog order, so the composed `--skills` list is deterministic. */
export function sortSkills(skills: ReadonlyArray<GentleAiSkillId>): ReadonlyArray<GentleAiSkillId> {
  const selected = new Set(skills);
  return GENTLE_AI_SKILLS.filter((skill) => selected.has(skill.id)).map((skill) => skill.id);
}

/**
 * Whether a skill is installed. An empty `state.skills` means "all defaults" in
 * the CLI's state file, not "no skills", so every catalog skill counts as
 * installed there.
 */
export function isSkillInstalled(
  skill: GentleAiSkillId,
  installed: ReadonlyArray<GentleAiSkillId>,
): boolean {
  return installed.length === 0 || installed.includes(skill);
}

// ── Wizard ─────────────────────────────────────────────────────

export const GENTLE_AI_WIZARD_STEPS = [
  { id: "agents", label: "Agents" },
  { id: "components", label: "Preset & components" },
  { id: "skills", label: "Skills" },
  { id: "persona", label: "Persona & SDD" },
  { id: "review", label: "Review & run" },
] as const;

export type GentleAiWizardStepId = (typeof GENTLE_AI_WIZARD_STEPS)[number]["id"];

export interface GentleAiWizardState {
  readonly step: GentleAiWizardStepId;
  readonly agents: ReadonlyArray<GentleAiAgentId>;
  readonly preset: GentleAiPresetId;
  readonly components: ReadonlyArray<GentleAiComponentId>;
  readonly skills: ReadonlyArray<GentleAiSkillId>;
  readonly persona: GentleAiPersonaId;
  readonly sddMode: GentleAiSddMode;
  readonly scope: GentleAiScope;
  readonly channel: GentleAiChannel;
}

export type GentleAiWizardAction =
  | { readonly type: "goto"; readonly step: GentleAiWizardStepId }
  | { readonly type: "next" }
  | { readonly type: "back" }
  | { readonly type: "toggleAgent"; readonly agent: GentleAiAgentId }
  | { readonly type: "setAgents"; readonly agents: ReadonlyArray<GentleAiAgentId> }
  | { readonly type: "setPreset"; readonly preset: GentleAiPresetId }
  | { readonly type: "toggleComponent"; readonly component: GentleAiComponentId }
  | { readonly type: "toggleSkill"; readonly skill: GentleAiSkillId }
  | {
      readonly type: "setSkillGroup";
      readonly skills: ReadonlyArray<GentleAiSkillId>;
      readonly selected: boolean;
    }
  | { readonly type: "clearSkills" }
  | { readonly type: "setPersona"; readonly persona: GentleAiPersonaId }
  | { readonly type: "setSddMode"; readonly sddMode: GentleAiSddMode }
  | { readonly type: "setScope"; readonly scope: GentleAiScope }
  | { readonly type: "setChannel"; readonly channel: GentleAiChannel }
  | { readonly type: "reset"; readonly state: GentleAiWizardState };

export const INITIAL_GENTLE_AI_WIZARD_STATE: GentleAiWizardState = {
  step: "agents",
  agents: [],
  preset: "full-gentleman",
  components: resolvePresetComponents("full-gentleman"),
  skills: [],
  persona: "gentleman",
  sddMode: "single",
  scope: "global",
  channel: "stable",
};

/**
 * Wizard state seeded from an existing install, so "Reconfigure" starts from
 * what the machine already has instead of the defaults.
 */
export function wizardStateFromInstallState(
  state: GentleAiInstallState | null,
  preselectedAgent?: GentleAiAgentId,
): GentleAiWizardState {
  const base =
    state === null
      ? INITIAL_GENTLE_AI_WIZARD_STATE
      : {
          ...INITIAL_GENTLE_AI_WIZARD_STATE,
          agents: state.installedAgents,
          preset: state.preset ?? inferPreset(state.components),
          components:
            state.components.length > 0
              ? sortComponents(state.components)
              : resolvePresetComponents(state.preset ?? "full-gentleman"),
          skills: sortSkills(state.skills),
          persona: state.persona ?? "gentleman",
          sddMode: state.sddMode ?? "single",
        };
  if (preselectedAgent === undefined || base.agents.includes(preselectedAgent)) {
    return base;
  }
  return { ...base, agents: [...base.agents, preselectedAgent] };
}

function stepIndex(step: GentleAiWizardStepId): number {
  return GENTLE_AI_WIZARD_STEPS.findIndex((candidate) => candidate.id === step);
}

/** The step at an index, clamped so first/last cannot walk off the stepper. */
function stepAt(index: number): GentleAiWizardStepId {
  const clamped = Math.min(Math.max(index, 0), GENTLE_AI_WIZARD_STEPS.length - 1);
  return GENTLE_AI_WIZARD_STEPS[clamped]!.id;
}

function toggle<A>(values: ReadonlyArray<A>, value: A): ReadonlyArray<A> {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function gentleAiWizardReducer(
  state: GentleAiWizardState,
  action: GentleAiWizardAction,
): GentleAiWizardState {
  switch (action.type) {
    case "goto":
      return state.step === action.step ? state : { ...state, step: action.step };
    case "next":
      return { ...state, step: stepAt(stepIndex(state.step) + 1) };
    case "back":
      return { ...state, step: stepAt(stepIndex(state.step) - 1) };
    case "toggleAgent":
      return { ...state, agents: toggle(state.agents, action.agent) };
    case "setAgents":
      return { ...state, agents: action.agents };
    case "setPreset":
      return {
        ...state,
        preset: action.preset,
        // `custom` keeps whatever is checked so switching to it does not wipe
        // the list the user is about to edit.
        components:
          action.preset === "custom" ? state.components : resolvePresetComponents(action.preset),
      };
    case "toggleComponent": {
      const components = sortComponents(toggle(state.components, action.component));
      return { ...state, components, preset: inferPreset(components) };
    }
    case "toggleSkill":
      return { ...state, skills: sortSkills(toggle(state.skills, action.skill)) };
    case "setSkillGroup": {
      const group = new Set(action.skills);
      const remaining = state.skills.filter((skill) => !group.has(skill));
      return {
        ...state,
        skills: sortSkills(action.selected ? [...remaining, ...action.skills] : remaining),
      };
    }
    case "clearSkills":
      return { ...state, skills: [] };
    case "setPersona":
      return { ...state, persona: action.persona };
    case "setSddMode":
      return { ...state, sddMode: action.sddMode };
    case "setScope":
      return { ...state, scope: action.scope };
    case "setChannel":
      return { ...state, channel: action.channel };
    case "reset":
      return action.state;
  }
}

/** The install request a wizard state describes. */
export function wizardInstallRequest(
  state: GentleAiWizardState,
  dryRun: boolean,
): GentleAiRunRequest {
  return {
    kind: "install",
    options: {
      agents: state.agents,
      components: state.components,
      skills: state.skills,
      persona: state.persona,
      preset: state.preset,
      sddMode: state.sddMode,
      scope: state.scope,
      channel: state.channel,
      dryRun,
    },
  };
}

/** Why the wizard cannot run yet, or `null` when it can. */
export function wizardBlockedReason(state: GentleAiWizardState): string | null {
  if (state.agents.length === 0) return "Select at least one agent to configure.";
  if (state.components.length === 0) return "Select at least one component to install.";
  return null;
}

// ── Display-only command composer ──────────────────────────────

function listFlag(flag: string, values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return values === undefined || values.length === 0 ? [] : [flag, values.join(",")];
}

function booleanFlag(flag: string, enabled: boolean | undefined): ReadonlyArray<string> {
  return enabled === true ? [flag] : [];
}

function valueFlag(flag: string, value: string | undefined): ReadonlyArray<string> {
  return value === undefined ? [] : [flag, value];
}

/**
 * The command line the server will build for a request, for display only.
 * Mirrors `apps/server/src/gentleAi/argv.ts`; a drift here is cosmetic because
 * the server never reads this string.
 */
export function composeCommandDisplay(
  request: GentleAiRunRequest,
  options: { readonly installHint?: string } = {},
): string {
  switch (request.kind) {
    case "install": {
      const install = request.options;
      return [
        "gentle-ai",
        "install",
        ...listFlag("--agents", install.agents),
        ...listFlag("--components", install.components),
        ...listFlag("--skills", install.skills),
        "--persona",
        install.persona,
        "--preset",
        install.preset,
        "--sdd-mode",
        install.sddMode,
        "--scope",
        install.scope,
        "--channel",
        install.channel,
        ...booleanFlag("--dry-run", install.dryRun),
      ].join(" ");
    }
    case "sync": {
      const sync = request.options;
      return [
        "gentle-ai",
        "sync",
        ...listFlag("--agents", sync.agents),
        ...listFlag("--skills", sync.skills),
        ...valueFlag("--sdd-mode", sync.sddMode),
        ...booleanFlag("--strict-tdd", sync.strictTdd),
        ...booleanFlag("--include-permissions", sync.includePermissions),
        ...booleanFlag("--include-theme", sync.includeTheme),
        ...booleanFlag("--dry-run", sync.dryRun),
      ].join(" ");
    }
    case "upgrade":
      return "gentle-ai upgrade";
    case "update-check":
      return "gentle-ai update";
    case "doctor":
      return "gentle-ai doctor";
    case "uninstall":
      return request.options.all === true
        ? "gentle-ai uninstall --all"
        : ["gentle-ai", "uninstall", ...listFlag("--agents", request.options.agents)].join(" ");
    case "skill-registry-refresh":
      return [
        "gentle-ai",
        "skill-registry",
        "refresh",
        "--cwd",
        request.options.workspaceRoot,
        ...booleanFlag("--force", request.options.force ?? true),
      ].join(" ");
    case "review-mode":
      return [
        "gentle-ai",
        "review",
        "mode",
        request.options.action,
        "--scope",
        request.options.scope,
        ...valueFlag("--cwd", request.options.cwd),
      ].join(" ");
    case "install-binary":
      return (
        options.installHint ??
        "go install github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@latest"
      );
  }
}

export const GENTLE_AI_COMMAND_LABELS: Readonly<Record<GentleAiCommandKind, string>> = {
  install: "Install",
  sync: "Sync",
  upgrade: "Upgrade",
  "update-check": "Check updates",
  doctor: "Doctor",
  uninstall: "Uninstall",
  "skill-registry-refresh": "Refresh skill registry",
  "install-binary": "Install binary",
  "review-mode": "Review mode",
};

// ── Console buffer ─────────────────────────────────────────────

export interface GentleAiConsoleLine {
  readonly id: number;
  readonly stream: GentleAiCommandStream;
  readonly text: string;
}

export type GentleAiConsoleStatus = "idle" | "running" | "succeeded" | "failed";

export interface GentleAiConsoleState {
  readonly status: GentleAiConsoleStatus;
  readonly kind: GentleAiCommandKind | null;
  /** The argv the server reported in its `started` event. */
  readonly command: string | null;
  readonly lines: ReadonlyArray<GentleAiConsoleLine>;
  readonly exitCode: number | null;
  readonly durationMs: number | null;
  /** Transport or spawn failure, as opposed to a non-zero exit. */
  readonly error: string | null;
  /** Lines dropped from the head once the buffer filled. */
  readonly droppedLines: number;
  readonly nextLineId: number;
}

/** Enough scrollback for a full install; a runaway command cannot grow the tab. */
export const GENTLE_AI_CONSOLE_MAX_LINES = 2_000;

export const EMPTY_GENTLE_AI_CONSOLE: GentleAiConsoleState = {
  status: "idle",
  kind: null,
  command: null,
  lines: [],
  exitCode: null,
  durationMs: null,
  error: null,
  droppedLines: 0,
  nextLineId: 0,
};

/** Clears the previous run and marks a new one as starting. */
export function beginConsoleRun(kind: GentleAiCommandKind): GentleAiConsoleState {
  return { ...EMPTY_GENTLE_AI_CONSOLE, status: "running", kind };
}

export function appendConsoleEvent(
  state: GentleAiConsoleState,
  event: GentleAiCommandEvent,
): GentleAiConsoleState {
  switch (event._tag) {
    case "started":
      return { ...state, status: "running", command: event.command };
    case "output": {
      const line: GentleAiConsoleLine = {
        id: state.nextLineId,
        stream: event.stream,
        text: event.line,
      };
      const appended = [...state.lines, line];
      const overflow = Math.max(appended.length - GENTLE_AI_CONSOLE_MAX_LINES, 0);
      return {
        ...state,
        lines: overflow === 0 ? appended : appended.slice(overflow),
        droppedLines: state.droppedLines + overflow,
        nextLineId: state.nextLineId + 1,
      };
    }
    case "exited":
      return {
        ...state,
        status: event.exitCode === 0 ? "succeeded" : "failed",
        exitCode: event.exitCode,
        durationMs: event.durationMs,
      };
  }
}

/** A stream that failed before (or instead of) reporting an exit. */
export function failConsoleRun(state: GentleAiConsoleState, message: string): GentleAiConsoleState {
  return { ...state, status: "failed", error: message };
}

/** The console contents as plain text, for the Copy button. */
export function formatConsoleText(state: GentleAiConsoleState): string {
  const header = state.command === null ? [] : [`$ ${state.command}`];
  const dropped =
    state.droppedLines === 0 ? [] : [`… ${state.droppedLines} earlier lines were dropped`];
  const body = state.lines.map((line) => line.text);
  const footer =
    state.exitCode === null
      ? state.error === null
        ? []
        : [`error: ${state.error}`]
      : [`exit ${state.exitCode}${state.durationMs === null ? "" : ` in ${state.durationMs}ms`}`];
  return [...header, ...dropped, ...body, ...footer].join("\n");
}

// ── Formatting helpers ─────────────────────────────────────────

export function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs}ms`;
  const seconds = durationMs / 1_000;
  return seconds < 60
    ? `${seconds.toFixed(1)}s`
    : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** Relative age of an ISO timestamp, or `null` when it cannot be parsed. */
export function formatRelativeTime(iso: string | null, now = Date.now()): string | null {
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const elapsed = Math.max(now - parsed, 0);
  if (elapsed < 60_000) return "just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The tier a model alias belongs to, for the model-assignments table. Gentle AI
 * writes aliases (`opus`, `sonnet`, `haiku`) rather than full model ids.
 */
export type GentleAiModelTier = "opus" | "sonnet" | "haiku" | "other";

export function modelTier(model: string): GentleAiModelTier {
  const normalized = model.toLowerCase();
  if (normalized.includes("opus")) return "opus";
  if (normalized.includes("sonnet")) return "sonnet";
  if (normalized.includes("haiku")) return "haiku";
  return "other";
}

export interface GentleAiPhaseAssignment {
  readonly phase: string;
  readonly model: string;
  readonly tier: GentleAiModelTier;
}

/**
 * Phase assignments in a stable order: the SDD chain in workflow order first,
 * then anything the CLI added that this build does not know about.
 */
const PHASE_ORDER: ReadonlyArray<string> = [
  "sdd-explore",
  "sdd-research",
  "sdd-propose",
  "sdd-spec",
  "sdd-design",
  "sdd-tasks",
  "sdd-apply",
  "sdd-verify",
  "sdd-archive",
  "sdd-onboard",
  "jd-judge-a",
  "jd-judge-b",
  "jd-fix-agent",
  "default",
];

export function listPhaseAssignments(
  assignments: Readonly<Record<string, string>>,
): ReadonlyArray<GentleAiPhaseAssignment> {
  const entries = Object.entries(assignments);
  const rank = (phase: string): number => {
    const index = PHASE_ORDER.indexOf(phase);
    return index === -1 ? PHASE_ORDER.length : index;
  };
  return entries
    .toSorted(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
    .map(([phase, model]) => ({ phase, model, tier: modelTier(model) }));
}
