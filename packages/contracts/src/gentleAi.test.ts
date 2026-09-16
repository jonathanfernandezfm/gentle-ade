import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  GENTLE_AI_AGENTS,
  GENTLE_AI_COMPONENTS,
  GENTLE_AI_PERSONAS,
  GENTLE_AI_PRESETS,
  GENTLE_AI_SKILLS,
  GentleAiCommandEvent,
  GentleAiInstallState,
  GentleAiRunRequest,
  type GentleAiComponentId,
} from "./gentleAi.ts";

const decodeInstallState = Schema.decodeUnknownSync(GentleAiInstallState);
const decodeRunRequest = Schema.decodeUnknownSync(GentleAiRunRequest);
const decodeCommandEvent = Schema.decodeUnknownSync(GentleAiCommandEvent);

const uniqueIds = (ids: ReadonlyArray<string>) => new Set(ids).size;

describe("Gentle AI catalog", () => {
  it("ships the full agent catalog with unique ids and populated copy", () => {
    expect(GENTLE_AI_AGENTS).toHaveLength(16);
    expect(uniqueIds(GENTLE_AI_AGENTS.map((agent) => agent.id))).toBe(16);
    for (const agent of GENTLE_AI_AGENTS) {
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.description.length).toBeGreaterThan(0);
      expect(agent.configPath.startsWith("~/")).toBe(true);
    }
  });

  it("ships the full component catalog with unique ids and populated copy", () => {
    expect(GENTLE_AI_COMPONENTS).toHaveLength(10);
    expect(uniqueIds(GENTLE_AI_COMPONENTS.map((component) => component.id))).toBe(10);
    for (const component of GENTLE_AI_COMPONENTS) {
      expect(component.name.length).toBeGreaterThan(0);
      expect(component.description.length).toBeGreaterThan(0);
    }
  });

  it("ships the full skill catalog grouped into the three known categories", () => {
    expect(GENTLE_AI_SKILLS).toHaveLength(25);
    expect(uniqueIds(GENTLE_AI_SKILLS.map((skill) => skill.id))).toBe(25);

    const byCategory = (category: string) =>
      GENTLE_AI_SKILLS.filter((skill) => skill.category === category).length;
    expect(byCategory("sdd")).toBe(11);
    expect(byCategory("testing")).toBe(2);
    expect(byCategory("workflow")).toBe(12);

    for (const skill of GENTLE_AI_SKILLS) {
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it("labels every persona", () => {
    expect(GENTLE_AI_PERSONAS).toHaveLength(4);
    expect(GENTLE_AI_PERSONAS.map((persona) => persona.id)).toEqual([
      "gentleman",
      "gentleman-neutral-artifacts",
      "neutral",
      "custom",
    ]);
  });
});

describe("Gentle AI presets", () => {
  const componentsFor = (id: string): ReadonlyArray<GentleAiComponentId> =>
    GENTLE_AI_PRESETS.find((preset) => preset.id === id)?.components ?? [];

  it("maps each preset to the components the CLI resolves for it", () => {
    expect([...componentsFor("full-gentleman")].sort()).toEqual([
      "claude-theme",
      "context7",
      "engram",
      "gga",
      "opencode-gentle-logo",
      "permissions",
      "persona",
      "sdd",
      "skills",
    ]);
    expect([...componentsFor("ecosystem-only")].sort()).toEqual([
      "context7",
      "engram",
      "gga",
      "persona",
      "sdd",
      "skills",
    ]);
    expect([...componentsFor("minimal")].sort()).toEqual(["engram", "persona"]);
    expect(componentsFor("custom")).toEqual([]);
  });

  it("only implies components that exist in the component catalog", () => {
    const known = new Set(GENTLE_AI_COMPONENTS.map((component) => component.id));
    for (const preset of GENTLE_AI_PRESETS) {
      for (const component of preset.components) {
        expect(known.has(component)).toBe(true);
      }
    }
  });
});

describe("GentleAiInstallState", () => {
  it("decodes a state snapshot written by the CLI", () => {
    const state = decodeInstallState({
      installedAgents: ["claude-code", "opencode"],
      installedBinaryVersion: "3.0.2",
      components: ["engram", "sdd", "skills"],
      skills: [],
      preset: "full-gentleman",
      persona: "gentleman",
      sddMode: "single",
      strictTdd: false,
      rddMode: "on",
      rddModeRecordedAt: "2026-09-16T20:23:18.7712225Z",
      lastUpdateCheck: "2026-09-16T22:23:28.7767789+03:00",
      pendingSync: false,
      claudePhaseAssignments: { "sdd-design": "opus", default: "sonnet" },
      communityTools: [],
      selectionConfigured: true,
    });

    expect(state.installedAgents).toEqual(["claude-code", "opencode"]);
    expect(state.skills).toEqual([]);
    expect(state.claudePhaseAssignments["sdd-design"]).toBe("opus");
    expect(state.rddMode).toBe("on");
  });

  it("rejects ids outside the catalog, so tolerance stays the server's job", () => {
    expect(() =>
      decodeInstallState({
        installedAgents: ["claude-code", "some-future-agent"],
        installedBinaryVersion: null,
        components: [],
        skills: [],
        preset: null,
        persona: null,
        sddMode: null,
        strictTdd: false,
        rddMode: "unknown",
        rddModeRecordedAt: null,
        lastUpdateCheck: null,
        pendingSync: false,
        claudePhaseAssignments: {},
        communityTools: [],
        selectionConfigured: false,
      }),
    ).toThrow();
  });
});

describe("GentleAiRunRequest", () => {
  it("decodes every command variant", () => {
    expect(
      decodeRunRequest({
        kind: "install",
        options: {
          agents: ["claude-code"],
          components: ["engram"],
          skills: ["sdd-apply"],
          persona: "gentleman",
          preset: "custom",
          sddMode: "single",
          scope: "global",
          channel: "stable",
          dryRun: true,
        },
      }).kind,
    ).toBe("install");
    expect(decodeRunRequest({ kind: "sync", options: { dryRun: false } }).kind).toBe("sync");
    expect(decodeRunRequest({ kind: "upgrade" }).kind).toBe("upgrade");
    expect(decodeRunRequest({ kind: "update-check" }).kind).toBe("update-check");
    expect(decodeRunRequest({ kind: "doctor" }).kind).toBe("doctor");
    expect(decodeRunRequest({ kind: "uninstall", options: { all: true } }).kind).toBe("uninstall");
    expect(decodeRunRequest({ kind: "install-binary" }).kind).toBe("install-binary");
    expect(
      decodeRunRequest({
        kind: "skill-registry-refresh",
        options: { workspaceRoot: "/repo", force: true },
      }).kind,
    ).toBe("skill-registry-refresh");
    expect(
      decodeRunRequest({
        kind: "review-mode",
        options: { action: "enable", scope: "clone", cwd: "/repo" },
      }).kind,
    ).toBe("review-mode");
  });

  it("refuses a command kind that is not in the closed set", () => {
    expect(() => decodeRunRequest({ kind: "shell", options: {} })).toThrow();
  });
});

describe("GentleAiCommandEvent", () => {
  it("decodes the console event stream", () => {
    expect(decodeCommandEvent({ _tag: "started", command: "gentle-ai doctor" })._tag).toBe(
      "started",
    );
    expect(decodeCommandEvent({ _tag: "output", stream: "stderr", line: "warn" })).toMatchObject({
      stream: "stderr",
      line: "warn",
    });
    expect(decodeCommandEvent({ _tag: "exited", exitCode: 0, durationMs: 1200 })).toMatchObject({
      exitCode: 0,
      durationMs: 1200,
    });
  });
});
