import { assert, it } from "@effect/vitest";

import { decodeGentleAiInstallState } from "./state.ts";

/** Trimmed from a real `~/.gentle-ai/state.json` written by 3.0.2. */
const REAL_STATE = {
  installed_agents: ["claude-code"],
  installed_binary_version: "3.0.2",
  managed_asset_digest: "sha256:12c77c29e435",
  selection_configured: true,
  components: ["engram", "sdd", "skills", "context7", "permissions", "gga", "claude-theme"],
  preset: "full-gentleman",
  community_tools_configured: true,
  claude_phase_assignments: {
    default: { model: "sonnet" },
    "sdd-design": { model: "opus" },
    "sdd-archive": { model: "haiku" },
  },
  persona: "gentleman",
  last_update_check: "2026-09-16T22:23:28.7767789+03:00",
  rdd_mode: "on",
  rdd_mode_recorded_at: "2026-09-16T20:23:18.7712225Z",
};

it("decodes a real state file into the contract shape", () => {
  const state = decodeGentleAiInstallState(REAL_STATE);

  assert.deepStrictEqual(state.installedAgents, ["claude-code"]);
  assert.strictEqual(state.installedBinaryVersion, "3.0.2");
  assert.deepStrictEqual(state.components, [
    "engram",
    "sdd",
    "skills",
    "context7",
    "permissions",
    "gga",
    "claude-theme",
  ]);
  assert.strictEqual(state.preset, "full-gentleman");
  assert.strictEqual(state.persona, "gentleman");
  assert.strictEqual(state.rddMode, "on");
  assert.strictEqual(state.rddModeRecordedAt, "2026-09-16T20:23:18.7712225Z");
  assert.strictEqual(state.lastUpdateCheck, "2026-09-16T22:23:28.7767789+03:00");
  assert.isTrue(state.selectionConfigured);
});

it("flattens claude_phase_assignments from { model } objects to a model per phase", () => {
  assert.deepStrictEqual(decodeGentleAiInstallState(REAL_STATE).claudePhaseAssignments, {
    default: "sonnet",
    "sdd-design": "opus",
    "sdd-archive": "haiku",
  });
});

it("accepts a plain string phase assignment in case the CLI flattens the shape", () => {
  assert.deepStrictEqual(
    decodeGentleAiInstallState({ claude_phase_assignments: { default: "opus", broken: 7 } })
      .claudePhaseAssignments,
    { default: "opus" },
  );
});

it("drops ids this build does not know instead of failing the read", () => {
  const state = decodeGentleAiInstallState({
    installed_agents: ["claude-code", "some-future-agent", "opencode"],
    components: ["engram", "future-component"],
    skills: ["sdd-apply", "future-skill"],
    preset: "future-preset",
    persona: "future-persona",
    sdd_mode: "quantum",
  });

  assert.deepStrictEqual(state.installedAgents, ["claude-code", "opencode"]);
  assert.deepStrictEqual(state.components, ["engram"]);
  assert.deepStrictEqual(state.skills, ["sdd-apply"]);
  assert.isNull(state.preset);
  assert.isNull(state.persona);
  assert.isNull(state.sddMode);
});

it("de-duplicates repeated ids", () => {
  assert.deepStrictEqual(
    decodeGentleAiInstallState({ installed_agents: ["codex", "codex", "cursor"] }).installedAgents,
    ["codex", "cursor"],
  );
});

it("reports an absent rdd_mode as unknown rather than off", () => {
  assert.strictEqual(decodeGentleAiInstallState({}).rddMode, "unknown");
  assert.strictEqual(decodeGentleAiInstallState({ rdd_mode: "off" }).rddMode, "off");
  assert.strictEqual(decodeGentleAiInstallState({ rdd_mode: "" }).rddMode, "unknown");
});

it("fills every field for an empty or malformed state file", () => {
  for (const raw of [{}, null, "nonsense", 42, []]) {
    const state = decodeGentleAiInstallState(raw);
    assert.deepStrictEqual(state.installedAgents, []);
    assert.deepStrictEqual(state.components, []);
    assert.deepStrictEqual(state.skills, []);
    assert.deepStrictEqual(state.communityTools, []);
    assert.deepStrictEqual(state.claudePhaseAssignments, {});
    assert.isNull(state.installedBinaryVersion);
    assert.isFalse(state.strictTdd);
    assert.isFalse(state.pendingSync);
    assert.isFalse(state.selectionConfigured);
  }
});

it("reads camelCase keys as a fallback, so a CLI rename does not blank the hub", () => {
  const state = decodeGentleAiInstallState({
    installedAgents: ["pi"],
    installedBinaryVersion: "3.1.0",
    sddMode: "multi",
    strictTdd: true,
    pendingSync: true,
    communityTools: ["gga", 7],
  });
  assert.deepStrictEqual(state.installedAgents, ["pi"]);
  assert.strictEqual(state.installedBinaryVersion, "3.1.0");
  assert.strictEqual(state.sddMode, "multi");
  assert.isTrue(state.strictTdd);
  assert.isTrue(state.pendingSync);
  assert.deepStrictEqual(state.communityTools, ["gga"]);
});
