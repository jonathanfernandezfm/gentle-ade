/**
 * Tolerant reader for `~/.gentle-ai/state.json`.
 *
 * The Go CLI owns that file, writes it in snake_case, and adds keys between
 * releases. A strict decode would make the hub useless the moment a newer CLI
 * installs an agent this build has never heard of, so unknown ids are dropped
 * and unknown keys ignored. The contract type stays clean; the tolerance lives
 * here.
 *
 * @module gentleAi/state
 */
import {
  GENTLE_AI_AGENTS,
  GENTLE_AI_COMPONENTS,
  GENTLE_AI_PERSONAS,
  GENTLE_AI_PRESETS,
  GENTLE_AI_SKILLS,
  type GentleAiAgentId,
  type GentleAiComponentId,
  type GentleAiInstallState,
  type GentleAiPersonaId,
  type GentleAiPresetId,
  type GentleAiRddMode,
  type GentleAiSddMode,
  type GentleAiSkillId,
} from "@t3tools/contracts";

const KNOWN_AGENT_IDS: ReadonlySet<string> = new Set(GENTLE_AI_AGENTS.map((agent) => agent.id));
const KNOWN_COMPONENT_IDS: ReadonlySet<string> = new Set(
  GENTLE_AI_COMPONENTS.map((component) => component.id),
);
const KNOWN_SKILL_IDS: ReadonlySet<string> = new Set(GENTLE_AI_SKILLS.map((skill) => skill.id));
const KNOWN_PERSONA_IDS: ReadonlySet<string> = new Set(
  GENTLE_AI_PERSONAS.map((persona) => persona.id),
);
const KNOWN_PRESET_IDS: ReadonlySet<string> = new Set(GENTLE_AI_PRESETS.map((preset) => preset.id));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Read a key by its snake_case name, falling back to camelCase. The CLI writes
 * snake_case; the fallback costs nothing and survives a future rename.
 */
const read = (source: Record<string, unknown>, snakeKey: string, camelKey: string): unknown =>
  source[snakeKey] ?? source[camelKey];

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const asBoolean = (value: unknown): boolean => value === true;

/** Keep only the ids this build knows; a newer CLI's additions are skipped. */
const filterKnown = <Id extends string>(value: unknown, known: ReadonlySet<string>): Array<Id> => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Array<Id> = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !known.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry as Id);
  }
  return result;
};

const asKnownLiteral = <Id extends string>(
  value: unknown,
  known: ReadonlySet<string>,
): Id | null => {
  const text = asStringOrNull(value);
  return text !== null && known.has(text) ? (text as Id) : null;
};

const asStringArray = (value: unknown): Array<string> =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/**
 * `claude_phase_assignments` maps a phase to `{ "model": "opus" }`. The hub only
 * ever shows the model, so the nesting is flattened away here; a plain string
 * value is accepted too, in case the CLI simplifies the shape later.
 */
const flattenPhaseAssignments = (value: unknown): Record<string, string> => {
  const source = asRecord(value);
  if (source === null) return {};
  const assignments: Record<string, string> = {};
  for (const [phase, assignment] of Object.entries(source)) {
    if (typeof assignment === "string") {
      const model = assignment.trim();
      if (model !== "") assignments[phase] = model;
      continue;
    }
    const model = asStringOrNull(asRecord(assignment)?.["model"]);
    if (model !== null) assignments[phase] = model;
  }
  return assignments;
};

const asRddMode = (value: unknown): GentleAiRddMode => {
  const text = asStringOrNull(value);
  return text === "on" || text === "off" ? text : "unknown";
};

const asSddMode = (value: unknown): GentleAiSddMode | null => {
  const text = asStringOrNull(value);
  return text === "single" || text === "multi" ? text : null;
};

/** Decode whatever the state file holds into the contract shape. Never fails. */
export function decodeGentleAiInstallState(raw: unknown): GentleAiInstallState {
  const source = asRecord(raw) ?? {};
  return {
    installedAgents: filterKnown<GentleAiAgentId>(
      read(source, "installed_agents", "installedAgents"),
      KNOWN_AGENT_IDS,
    ),
    installedBinaryVersion: asStringOrNull(
      read(source, "installed_binary_version", "installedBinaryVersion"),
    ),
    components: filterKnown<GentleAiComponentId>(source["components"], KNOWN_COMPONENT_IDS),
    skills: filterKnown<GentleAiSkillId>(source["skills"], KNOWN_SKILL_IDS),
    preset: asKnownLiteral<GentleAiPresetId>(source["preset"], KNOWN_PRESET_IDS),
    persona: asKnownLiteral<GentleAiPersonaId>(source["persona"], KNOWN_PERSONA_IDS),
    sddMode: asSddMode(read(source, "sdd_mode", "sddMode")),
    strictTdd: asBoolean(read(source, "strict_tdd", "strictTdd")),
    rddMode: asRddMode(read(source, "rdd_mode", "rddMode")),
    rddModeRecordedAt: asStringOrNull(read(source, "rdd_mode_recorded_at", "rddModeRecordedAt")),
    lastUpdateCheck: asStringOrNull(read(source, "last_update_check", "lastUpdateCheck")),
    pendingSync: asBoolean(read(source, "pending_sync", "pendingSync")),
    claudePhaseAssignments: flattenPhaseAssignments(
      read(source, "claude_phase_assignments", "claudePhaseAssignments"),
    ),
    communityTools: asStringArray(read(source, "community_tools", "communityTools")),
    selectionConfigured: asBoolean(read(source, "selection_configured", "selectionConfigured")),
  };
}
