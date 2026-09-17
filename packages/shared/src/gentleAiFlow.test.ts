import { describe, expect, it } from "@effect/vitest";

import { buildGentleAiFlowInvocation, resolveGentleAiFlowRoute } from "./gentleAiFlow.ts";

const NONE = new Set<string>();

describe("buildGentleAiFlowInvocation", () => {
  it("leaves organic text untouched", () => {
    const result = buildGentleAiFlowInvocation({
      flowId: "organic",
      provider: "claudeAgent",
      text: "  fix the tests  ",
      availableSlashCommands: new Set(["gentle-sdd-new"]),
      availableSkills: new Set(["sdd-explore"]),
    });
    expect(result).toEqual({ kind: "none", text: "  fix the tests  ", token: null });
  });

  describe("claude", () => {
    it("prefers the installed gentle-sdd-* command", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-new",
        provider: "claudeAgent",
        text: "auth refactor",
        availableSlashCommands: new Set(["gentle-sdd-new"]),
        availableSkills: NONE,
      });
      expect(result).toEqual({
        kind: "slash-command",
        text: "/gentle-sdd-new auth refactor",
        token: "/gentle-sdd-new",
      });
    });

    it("falls back to the skill as a slash command when the command is missing", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-explore",
        provider: "claude",
        text: "caching layer",
        availableSlashCommands: NONE,
        availableSkills: new Set(["sdd-explore"]),
      });
      expect(result).toEqual({
        kind: "slash-command",
        text: "/sdd-explore caching layer",
        token: "/sdd-explore",
      });
    });

    it("sends prose when neither the command nor the skill is installed", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "judgment-day",
        provider: "claudeAgent",
        text: "review the branch",
        availableSlashCommands: NONE,
        availableSkills: NONE,
      });
      expect(result.kind).toBe("prose");
      expect(result.token).toBeNull();
      expect(result.text).toBe(
        'Use the Gentle AI "judgment-day" skill for this request: find its SKILL.md in the project or user skills directory, read it first, and follow it exactly.\n\nreview the branch',
      );
    });
  });

  describe("opencode", () => {
    it("uses the sdd-* command when installed", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-apply",
        provider: "opencode",
        text: "",
        availableSlashCommands: new Set(["sdd-apply"]),
        availableSkills: new Set(["sdd-apply"]),
      });
      expect(result).toEqual({ kind: "slash-command", text: "/sdd-apply", token: "/sdd-apply" });
    });

    it("mentions the skill when only the skill is installed", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-apply",
        provider: "opencode",
        text: "tasks 3-5",
        availableSlashCommands: NONE,
        availableSkills: new Set(["sdd-apply"]),
      });
      expect(result).toEqual({
        kind: "skill-mention",
        text: "$sdd-apply tasks 3-5",
        token: "$sdd-apply",
      });
    });
  });

  describe("codex and other providers", () => {
    it("mentions the skill on codex", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-init",
        provider: "codex",
        text: "openspec",
        availableSlashCommands: new Set(["gentle-sdd-init", "sdd-init"]),
        availableSkills: new Set(["sdd-init"]),
      });
      expect(result).toEqual({
        kind: "skill-mention",
        text: "$sdd-init openspec",
        token: "$sdd-init",
      });
    });

    it("ignores slash commands on providers that do not expand them", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-new",
        provider: "cursor",
        text: "billing",
        availableSlashCommands: new Set(["gentle-sdd-new", "sdd-new"]),
        availableSkills: NONE,
      });
      expect(result.kind).toBe("prose");
      expect(result.text).toBe(
        "Follow the Gentle AI SDD orchestrator workflow (read the _shared/sdd-orchestrator-workflow.md next to your installed skills first) to start a new SDD change: explore first, then propose.\n\nbilling",
      );
    });

    it("does not leave a trailing separator when the text is empty", () => {
      const result = buildGentleAiFlowInvocation({
        flowId: "sdd-status",
        provider: "grok",
        text: "   ",
        availableSlashCommands: NONE,
        availableSkills: NONE,
      });
      expect(result.text).toBe(
        "Follow the Gentle AI SDD orchestrator workflow (read the _shared/sdd-orchestrator-workflow.md next to your installed skills first) to report the structured SDD status for the active change.",
      );
    });
  });

  it("trims trailing whitespace but keeps the leading token first", () => {
    const result = buildGentleAiFlowInvocation({
      flowId: "sdd-verify",
      provider: "claudeAgent",
      text: "the change\n\n",
      availableSlashCommands: new Set(["gentle-sdd-verify"]),
      availableSkills: NONE,
    });
    expect(result.text).toBe("/gentle-sdd-verify the change");
  });
});

describe("resolveGentleAiFlowRoute", () => {
  it("reports the token the picker should show without composing text", () => {
    expect(
      resolveGentleAiFlowRoute({
        flowId: "skill-registry",
        provider: "opencode",
        availableSlashCommands: new Set(["skill-registry"]),
        availableSkills: NONE,
      }),
    ).toEqual({ kind: "slash-command", token: "/skill-registry" });
    expect(
      resolveGentleAiFlowRoute({
        flowId: "organic",
        provider: "opencode",
        availableSlashCommands: NONE,
        availableSkills: NONE,
      }),
    ).toEqual({ kind: "none", token: null });
  });
});
