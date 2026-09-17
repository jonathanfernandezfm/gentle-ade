/**
 * Pure helpers behind the composer's Gentle AI flow picker: the grouped option
 * list with per-provider availability hints, the accent classes the frame
 * takes per flow group, and the readiness banner copy. Everything that touches
 * React or the stores lives in `GentleFlowPicker.tsx` and
 * `GentleReadinessBanner.tsx`; this file is what the tests exercise.
 */
import {
  GENTLE_AI_FLOW_BY_ID,
  GENTLE_AI_FLOWS,
  PROVIDER_DISPLAY_NAMES,
  deriveGentleAiProjectReadiness,
  type GentleAiFlowGroup,
  type GentleAiFlowId,
  type GentleAiProjectReadiness,
  type GentleAiProjectStatus,
  type ProviderDriverKind,
} from "@t3tools/contracts";
import { resolveGentleAiFlowRoute } from "@t3tools/shared/gentleAiFlow";

export type GentleFlowAccentGroup = Exclude<GentleAiFlowGroup, "organic">;

/** Per-group accent, also the value of `--gentle-flow-accent` in `index.css`. */
export const GENTLE_FLOW_ACCENT: Record<GentleFlowAccentGroup, string> = {
  sdd: "#f095c8",
  review: "#f5b94a",
  workflow: "#5ed4c3",
};

export const GENTLE_FLOW_GROUP_ORDER: ReadonlyArray<GentleAiFlowGroup> = [
  "organic",
  "sdd",
  "review",
  "workflow",
];

export const GENTLE_FLOW_GROUP_LABELS: Record<GentleAiFlowGroup, string> = {
  organic: "Organic",
  sdd: "SDD",
  review: "Review",
  workflow: "Workflow",
};

/** The `Select` value for a flow: organic is `null` in the draft but needs a real value here. */
export const ORGANIC_FLOW_VALUE: GentleAiFlowId = "organic";

export function gentleFlowFromSelectValue(value: string | null | undefined): GentleAiFlowId | null {
  if (!value || value === ORGANIC_FLOW_VALUE) return null;
  return GENTLE_AI_FLOW_BY_ID.has(value as GentleAiFlowId) ? (value as GentleAiFlowId) : null;
}

export function gentleFlowGroup(flow: GentleAiFlowId | null): GentleAiFlowGroup {
  return flow === null ? "organic" : (GENTLE_AI_FLOW_BY_ID.get(flow)?.group ?? "organic");
}

export function gentleFlowAccent(flow: GentleAiFlowId | null): string | null {
  const group = gentleFlowGroup(flow);
  return group === "organic" ? null : GENTLE_FLOW_ACCENT[group];
}

/**
 * Classes for `ComposerSurface.Main` while a non-organic flow is selected. The
 * group modifier picks the accent; the base class draws the masked border (see
 * `.gentle-flow-frame` in `index.css`).
 */
export function gentleFlowFrameClassName(flow: GentleAiFlowId | null): string | undefined {
  const group = gentleFlowGroup(flow);
  return group === "organic" ? undefined : `gentle-flow-frame gentle-flow-frame--${group}`;
}

export function gentleFlowShortLabel(flow: GentleAiFlowId | null): string {
  return flow === null ? "Organic" : (GENTLE_AI_FLOW_BY_ID.get(flow)?.shortLabel ?? "Organic");
}

export function gentleFlowPlaceholder(flow: GentleAiFlowId | null): string | null {
  return flow === null ? null : (GENTLE_AI_FLOW_BY_ID.get(flow)?.placeholder ?? null);
}

export interface GentleFlowOption {
  readonly id: GentleAiFlowId;
  readonly group: GentleAiFlowGroup;
  /** Label inside its group header, e.g. "New change" rather than "SDD · New change". */
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  /** "via /gentle-sdd-new", "via $sdd-explore", or the prose-fallback notice. */
  readonly hint: string | null;
  /** False when the provider has neither the command nor the skill and gets prose instead. */
  readonly installed: boolean;
}

export interface GentleFlowOptionGroup {
  readonly group: GentleAiFlowGroup;
  readonly label: string;
  readonly options: ReadonlyArray<GentleFlowOption>;
}

function providerLabel(provider: ProviderDriverKind): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

function menuLabel(label: string): string {
  const separator = label.indexOf(" · ");
  return separator === -1 ? label : label.slice(separator + 3);
}

/** Grouped picker options in catalog order, with availability read from the workspace snapshot. */
export function buildGentleFlowOptionGroups(input: {
  readonly provider: ProviderDriverKind;
  readonly availableSlashCommands: ReadonlySet<string>;
  readonly availableSkills: ReadonlySet<string>;
}): ReadonlyArray<GentleFlowOptionGroup> {
  const fallbackHint = `not installed for ${providerLabel(input.provider)} — sends instructions instead`;
  return GENTLE_FLOW_GROUP_ORDER.map((group) => ({
    group,
    label: GENTLE_FLOW_GROUP_LABELS[group],
    options: GENTLE_AI_FLOWS.filter((flow) => flow.group === group).map((flow) => {
      const route = resolveGentleAiFlowRoute({
        flowId: flow.id,
        provider: input.provider,
        availableSlashCommands: input.availableSlashCommands,
        availableSkills: input.availableSkills,
      });
      const installed = route.kind !== "prose";
      return {
        id: flow.id,
        group,
        label: menuLabel(flow.label),
        shortLabel: flow.shortLabel,
        description: flow.description,
        hint:
          route.kind === "none" ? null : route.token !== null ? `via ${route.token}` : fallbackHint,
        installed,
      };
    }),
  }));
}

export interface GentleReadinessCopy {
  readonly readiness: Exclude<GentleAiProjectReadiness, "ready" | "not-applicable">;
  readonly title: string;
  readonly description: string;
}

/** Banner copy for a repository that still needs `sdd-init`; `null` when nothing is missing. */
export function buildGentleReadinessCopy(
  status: Pick<GentleAiProjectStatus, "isGitRepo" | "skillRegistry" | "openspecConfigPresent">,
): GentleReadinessCopy | null {
  const readiness = deriveGentleAiProjectReadiness(status);
  if (readiness === "ready" || readiness === "not-applicable") return null;
  const missing = [
    ...(status.skillRegistry.present ? [] : ["the skill registry (.atl/skill-registry.md)"]),
    ...(status.openspecConfigPresent ? [] : ["the SDD workspace (openspec/config.yaml)"]),
  ];
  return {
    readiness,
    title:
      readiness === "partial"
        ? "Gentle AI is partially set up in this repository"
        : "Gentle AI isn't set up in this repository",
    description: `Missing ${missing.join(" and ")}. Run SDD init once to write them.`,
  };
}
