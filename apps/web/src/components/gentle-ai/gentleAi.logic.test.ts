import { describe, expect, it } from "vite-plus/test";
import type { GentleAiInstallState } from "@t3tools/contracts";

import {
  appendConsoleEvent,
  beginConsoleRun,
  composeCommandDisplay,
  EMPTY_GENTLE_AI_CONSOLE,
  failConsoleRun,
  filterSkills,
  formatConsoleText,
  formatRelativeTime,
  GENTLE_AI_CONSOLE_MAX_LINES,
  gentleAiWizardReducer,
  groupSkills,
  inferPreset,
  INITIAL_GENTLE_AI_WIZARD_STATE,
  isSkillInstalled,
  listPhaseAssignments,
  resolvePresetComponents,
  sortComponents,
  wizardBlockedReason,
  wizardInstallRequest,
  wizardStateFromInstallState,
} from "./gentleAi.logic";

const INSTALL_STATE: GentleAiInstallState = {
  installedAgents: ["claude-code"],
  installedBinaryVersion: "3.0.2",
  components: ["persona", "engram"],
  skills: [],
  preset: "minimal",
  persona: "gentleman",
  sddMode: "multi",
  strictTdd: false,
  rddMode: "off",
  rddModeRecordedAt: null,
  lastUpdateCheck: null,
  pendingSync: false,
  claudePhaseAssignments: { "sdd-apply": "sonnet", "sdd-propose": "opus" },
  communityTools: [],
  selectionConfigured: true,
};

describe("presets", () => {
  it("resolves the components a preset implies", () => {
    expect(resolvePresetComponents("minimal")).toEqual(["persona", "engram"]);
    expect(resolvePresetComponents("full-gentleman")).toHaveLength(9);
    expect(resolvePresetComponents("full-gentleman")).not.toContain("theme");
  });

  it("resolves custom to nothing so a deliberate selection is never overwritten", () => {
    expect(resolvePresetComponents("custom")).toEqual([]);
  });

  it("orders a selection by the catalog", () => {
    expect(sortComponents(["gga", "engram", "persona"])).toEqual(["engram", "persona", "gga"]);
  });

  it("infers the matching preset, or custom", () => {
    expect(inferPreset(["engram", "persona"])).toBe("minimal");
    expect(inferPreset(["persona"])).toBe("custom");
    expect(inferPreset([])).toBe("custom");
  });
});

describe("skills", () => {
  it("filters by query and category", () => {
    expect(filterSkills("no such skill").map((skill) => skill.id)).toEqual([]);
    expect(filterSkills("bubbletea").map((skill) => skill.id)).toEqual(["go-testing"]);
    expect(filterSkills("", "testing").every((skill) => skill.category === "testing")).toBe(true);
    expect(filterSkills("sdd", "workflow").every((skill) => skill.category === "workflow")).toBe(
      true,
    );
  });

  it("groups by category and drops emptied groups", () => {
    expect(groupSkills().map((group) => group.category)).toEqual(["sdd", "testing", "workflow"]);
    expect(groupSkills(filterSkills("", "testing")).map((group) => group.category)).toEqual([
      "testing",
    ]);
  });

  it("treats an empty installed list as the default set", () => {
    expect(isSkillInstalled("sdd-apply", [])).toBe(true);
    expect(isSkillInstalled("sdd-apply", ["sdd-verify"])).toBe(false);
    expect(isSkillInstalled("sdd-verify", ["sdd-verify"])).toBe(true);
  });
});

describe("wizard reducer", () => {
  it("walks the stepper without leaving its bounds", () => {
    const first = gentleAiWizardReducer(INITIAL_GENTLE_AI_WIZARD_STATE, { type: "back" });
    expect(first.step).toBe("agents");
    const last = ["next", "next", "next", "next", "next", "next"].reduce(
      (state) => gentleAiWizardReducer(state, { type: "next" }),
      INITIAL_GENTLE_AI_WIZARD_STATE,
    );
    expect(last.step).toBe("review");
  });

  it("applies a preset to the component checklist", () => {
    const next = gentleAiWizardReducer(INITIAL_GENTLE_AI_WIZARD_STATE, {
      type: "setPreset",
      preset: "minimal",
    });
    expect(next.components).toEqual(["persona", "engram"]);
  });

  it("keeps the checklist when switching to custom", () => {
    const next = gentleAiWizardReducer(
      { ...INITIAL_GENTLE_AI_WIZARD_STATE, components: ["engram"] },
      { type: "setPreset", preset: "custom" },
    );
    expect(next.components).toEqual(["engram"]);
  });

  it("falls back to custom once a component breaks the preset", () => {
    const minimal = gentleAiWizardReducer(INITIAL_GENTLE_AI_WIZARD_STATE, {
      type: "setPreset",
      preset: "minimal",
    });
    const edited = gentleAiWizardReducer(minimal, { type: "toggleComponent", component: "gga" });
    expect(edited.preset).toBe("custom");
    expect(edited.components).toEqual(["engram", "persona", "gga"]);
  });

  it("toggles agents and skills", () => {
    const withAgent = gentleAiWizardReducer(INITIAL_GENTLE_AI_WIZARD_STATE, {
      type: "toggleAgent",
      agent: "codex",
    });
    expect(withAgent.agents).toEqual(["codex"]);
    expect(
      gentleAiWizardReducer(withAgent, { type: "toggleAgent", agent: "codex" }).agents,
    ).toEqual([]);
    const withSkills = gentleAiWizardReducer(INITIAL_GENTLE_AI_WIZARD_STATE, {
      type: "setSkillGroup",
      skills: ["sdd-apply", "sdd-verify"],
      selected: true,
    });
    expect(withSkills.skills).toEqual(["sdd-apply", "sdd-verify"]);
    expect(
      gentleAiWizardReducer(withSkills, {
        type: "setSkillGroup",
        skills: ["sdd-apply"],
        selected: false,
      }).skills,
    ).toEqual(["sdd-verify"]);
    expect(gentleAiWizardReducer(withSkills, { type: "clearSkills" }).skills).toEqual([]);
  });

  it("seeds from an existing install and can preselect an agent", () => {
    const seeded = wizardStateFromInstallState(INSTALL_STATE, "codex");
    expect(seeded.agents).toEqual(["claude-code", "codex"]);
    expect(seeded.preset).toBe("minimal");
    expect(seeded.components).toEqual(["engram", "persona"]);
    expect(seeded.sddMode).toBe("multi");
    expect(wizardStateFromInstallState(null)).toEqual(INITIAL_GENTLE_AI_WIZARD_STATE);
  });

  it("blocks a run without agents or components", () => {
    expect(wizardBlockedReason(INITIAL_GENTLE_AI_WIZARD_STATE)).toMatch(/agent/);
    const withAgent = { ...INITIAL_GENTLE_AI_WIZARD_STATE, agents: ["codex" as const] };
    expect(wizardBlockedReason(withAgent)).toBeNull();
    expect(wizardBlockedReason({ ...withAgent, components: [] })).toMatch(/component/);
  });

  it("builds the install request it describes", () => {
    const request = wizardInstallRequest(
      { ...INITIAL_GENTLE_AI_WIZARD_STATE, agents: ["claude-code"] },
      true,
    );
    expect(request).toEqual({
      kind: "install",
      options: {
        agents: ["claude-code"],
        components: resolvePresetComponents("full-gentleman"),
        skills: [],
        persona: "gentleman",
        preset: "full-gentleman",
        sddMode: "single",
        scope: "global",
        channel: "stable",
        dryRun: true,
      },
    });
  });
});

describe("composeCommandDisplay", () => {
  it("mirrors the install argv the server builds", () => {
    expect(
      composeCommandDisplay({
        kind: "install",
        options: {
          agents: ["claude-code", "codex"],
          components: ["engram", "persona"],
          skills: ["sdd-apply"],
          persona: "gentleman",
          preset: "custom",
          sddMode: "single",
          scope: "global",
          channel: "stable",
          dryRun: true,
        },
      }),
    ).toBe(
      "gentle-ai install --agents claude-code,codex --components engram,persona --skills sdd-apply --persona gentleman --preset custom --sdd-mode single --scope global --channel stable --dry-run",
    );
  });

  it("omits empty list flags and false booleans", () => {
    expect(composeCommandDisplay({ kind: "sync", options: { dryRun: false } })).toBe(
      "gentle-ai sync",
    );
    expect(
      composeCommandDisplay({ kind: "sync", options: { strictTdd: true, dryRun: false } }),
    ).toBe("gentle-ai sync --strict-tdd");
    expect(
      composeCommandDisplay({ kind: "sync", options: { strictTdd: false, dryRun: false } }),
    ).toBe("gentle-ai sync");
  });

  it("maps update-check to the CLI's update verb", () => {
    expect(composeCommandDisplay({ kind: "update-check" })).toBe("gentle-ai update");
    expect(composeCommandDisplay({ kind: "upgrade" })).toBe("gentle-ai upgrade");
    expect(composeCommandDisplay({ kind: "doctor" })).toBe("gentle-ai doctor");
  });

  it("prefers --all over per-agent uninstall", () => {
    expect(
      composeCommandDisplay({ kind: "uninstall", options: { all: true, agents: ["codex"] } }),
    ).toBe("gentle-ai uninstall --all");
    expect(composeCommandDisplay({ kind: "uninstall", options: { agents: ["codex"] } })).toBe(
      "gentle-ai uninstall --agents codex",
    );
  });

  it("forces the skill registry refresh by default", () => {
    expect(
      composeCommandDisplay({
        kind: "skill-registry-refresh",
        options: { workspaceRoot: "/repo" },
      }),
    ).toBe("gentle-ai skill-registry refresh --cwd /repo --force");
  });

  it("composes the review mode command with an optional cwd", () => {
    expect(
      composeCommandDisplay({
        kind: "review-mode",
        options: { action: "enable", scope: "global" },
      }),
    ).toBe("gentle-ai review mode enable --scope global");
    expect(
      composeCommandDisplay({
        kind: "review-mode",
        options: { action: "disable", scope: "clone", cwd: "/repo" },
      }),
    ).toBe("gentle-ai review mode disable --scope clone --cwd /repo");
  });

  it("uses the host's install hint for the binary bootstrap", () => {
    expect(
      composeCommandDisplay({ kind: "install-binary" }, { installHint: "curl … | bash" }),
    ).toBe("curl … | bash");
  });
});

describe("console buffer", () => {
  it("collects started, output, and exit into one run", () => {
    let state = beginConsoleRun("doctor");
    expect(state.status).toBe("running");
    state = appendConsoleEvent(state, { _tag: "started", command: "gentle-ai doctor" });
    state = appendConsoleEvent(state, { _tag: "output", stream: "stdout", line: "ok" });
    state = appendConsoleEvent(state, { _tag: "output", stream: "stderr", line: "warn" });
    state = appendConsoleEvent(state, { _tag: "exited", exitCode: 0, durationMs: 120 });
    expect(state.status).toBe("succeeded");
    expect(state.command).toBe("gentle-ai doctor");
    expect(state.lines.map((line) => line.stream)).toEqual(["stdout", "stderr"]);
    expect(state.lines.map((line) => line.id)).toEqual([0, 1]);
    expect(formatConsoleText(state)).toBe("$ gentle-ai doctor\nok\nwarn\nexit 0 in 120ms");
  });

  it("treats a non-zero exit as a failed run, not a stream error", () => {
    const state = appendConsoleEvent(beginConsoleRun("sync"), {
      _tag: "exited",
      exitCode: 2,
      durationMs: 5,
    });
    expect(state.status).toBe("failed");
    expect(state.exitCode).toBe(2);
    expect(state.error).toBeNull();
  });

  it("records a transport failure separately", () => {
    const state = failConsoleRun(beginConsoleRun("sync"), "not connected");
    expect(state.status).toBe("failed");
    expect(formatConsoleText(state)).toBe("error: not connected");
  });

  it("drops the oldest lines once the buffer fills", () => {
    let state = beginConsoleRun("install");
    for (let index = 0; index < GENTLE_AI_CONSOLE_MAX_LINES + 5; index += 1) {
      state = appendConsoleEvent(state, {
        _tag: "output",
        stream: "stdout",
        line: `line ${index}`,
      });
    }
    expect(state.lines).toHaveLength(GENTLE_AI_CONSOLE_MAX_LINES);
    expect(state.droppedLines).toBe(5);
    expect(state.lines[0]?.text).toBe("line 5");
    expect(formatConsoleText(state)).toContain("5 earlier lines were dropped");
  });

  it("starts empty", () => {
    expect(EMPTY_GENTLE_AI_CONSOLE.lines).toEqual([]);
    expect(formatConsoleText(EMPTY_GENTLE_AI_CONSOLE)).toBe("");
  });
});

describe("formatting", () => {
  it("formats relative times and rejects unparseable ones", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    expect(formatRelativeTime("2026-01-01T11:59:30.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-01-01T11:30:00.000Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-01-01T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2025-12-30T12:00:00.000Z", now)).toBe("2d ago");
    expect(formatRelativeTime("not a date", now)).toBeNull();
    expect(formatRelativeTime(null, now)).toBeNull();
  });

  it("orders phase assignments by the SDD chain and tags model tiers", () => {
    const rows = listPhaseAssignments({
      default: "sonnet",
      "sdd-apply": "sonnet",
      "sdd-propose": "opus",
      "zz-custom": "haiku",
    });
    expect(rows.map((row) => row.phase)).toEqual([
      "sdd-propose",
      "sdd-apply",
      "default",
      "zz-custom",
    ]);
    expect(rows.map((row) => row.tier)).toEqual(["opus", "sonnet", "sonnet", "haiku"]);
  });
});
