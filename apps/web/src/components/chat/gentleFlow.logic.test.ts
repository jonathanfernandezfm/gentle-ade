import { ProviderDriverKind } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildGentleFlowOptionGroups,
  buildGentleReadinessCopy,
  gentleFlowAccent,
  gentleFlowFrameClassName,
  gentleFlowFromSelectValue,
  gentleFlowPlaceholder,
  gentleFlowShortLabel,
} from "./gentleFlow.logic";

const CLAUDE = ProviderDriverKind.make("claudeAgent");
const CODEX = ProviderDriverKind.make("codex");

describe("buildGentleFlowOptionGroups", () => {
  it("keeps the Organic / SDD / Review / Workflow order and labels items inside their group", () => {
    const groups = buildGentleFlowOptionGroups({
      provider: CLAUDE,
      availableSlashCommands: new Set(),
      availableSkills: new Set(),
    });
    expect(groups.map((group) => group.label)).toEqual(["Organic", "SDD", "Review", "Workflow"]);
    expect(groups[0]?.options.map((option) => option.id)).toEqual(["organic"]);
    expect(groups[1]?.options[1]).toMatchObject({ id: "sdd-new", label: "New change" });
  });

  it("hints the token a provider will expand and marks prose fallbacks as not installed", () => {
    const groups = buildGentleFlowOptionGroups({
      provider: CLAUDE,
      availableSlashCommands: new Set(["gentle-sdd-new"]),
      availableSkills: new Set(["judgment-day"]),
    });
    const byId = new Map(groups.flatMap((group) => group.options).map((o) => [o.id, o]));
    expect(byId.get("organic")).toMatchObject({ hint: null, installed: true });
    expect(byId.get("sdd-new")).toMatchObject({ hint: "via /gentle-sdd-new", installed: true });
    expect(byId.get("judgment-day")).toMatchObject({ hint: "via /judgment-day", installed: true });
    expect(byId.get("chained-pr")).toMatchObject({
      hint: "not installed for Claude — sends instructions instead",
      installed: false,
    });
  });

  it("uses skill mentions on codex", () => {
    const groups = buildGentleFlowOptionGroups({
      provider: CODEX,
      availableSlashCommands: new Set(["gentle-sdd-explore"]),
      availableSkills: new Set(["sdd-explore"]),
    });
    const explore = groups.flatMap((g) => g.options).find((o) => o.id === "sdd-explore");
    expect(explore).toMatchObject({ hint: "via $sdd-explore", installed: true });
  });
});

describe("flow presentation helpers", () => {
  it("maps flows to their group accent and frame classes", () => {
    expect(gentleFlowFrameClassName(null)).toBeUndefined();
    expect(gentleFlowFrameClassName("sdd-apply")).toBe("gentle-flow-frame gentle-flow-frame--sdd");
    expect(gentleFlowFrameClassName("judgment-day")).toBe(
      "gentle-flow-frame gentle-flow-frame--review",
    );
    expect(gentleFlowAccent("go-testing")).toBe("#5ed4c3");
    expect(gentleFlowAccent(null)).toBeNull();
  });

  it("round-trips the select value and exposes labels and placeholders", () => {
    expect(gentleFlowFromSelectValue("organic")).toBeNull();
    expect(gentleFlowFromSelectValue("sdd-ff")).toBe("sdd-ff");
    expect(gentleFlowFromSelectValue("nope")).toBeNull();
    expect(gentleFlowShortLabel(null)).toBe("Organic");
    expect(gentleFlowShortLabel("sdd-new")).toBe("New change");
    expect(gentleFlowPlaceholder(null)).toBeNull();
    expect(gentleFlowPlaceholder("sdd-new")).toBe("Name the change and what it should achieve…");
  });
});

describe("buildGentleReadinessCopy", () => {
  const registry = (present: boolean) => ({
    present,
    path: ".atl/skill-registry.md",
    skillCount: present ? 12 : null,
    updatedAt: null,
  });

  it("returns nothing for ready repositories and non-git folders", () => {
    expect(
      buildGentleReadinessCopy({
        isGitRepo: true,
        skillRegistry: registry(true),
        openspecConfigPresent: true,
      }),
    ).toBeNull();
    expect(
      buildGentleReadinessCopy({
        isGitRepo: false,
        skillRegistry: registry(false),
        openspecConfigPresent: false,
      }),
    ).toBeNull();
  });

  it("names exactly what is missing", () => {
    expect(
      buildGentleReadinessCopy({
        isGitRepo: true,
        skillRegistry: registry(false),
        openspecConfigPresent: false,
      }),
    ).toEqual({
      readiness: "missing",
      title: "Gentle AI isn't set up in this repository",
      description:
        "Missing the skill registry (.atl/skill-registry.md) and the SDD workspace (openspec/config.yaml). Run SDD init once to write them.",
    });
    expect(
      buildGentleReadinessCopy({
        isGitRepo: true,
        skillRegistry: registry(true),
        openspecConfigPresent: false,
      }),
    ).toMatchObject({
      readiness: "partial",
      title: "Gentle AI is partially set up in this repository",
      description:
        "Missing the SDD workspace (openspec/config.yaml). Run SDD init once to write them.",
    });
  });
});
