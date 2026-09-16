import { assert, it } from "@effect/vitest";
import type { GentleAiRunRequest } from "@t3tools/contracts";

import {
  GENTLE_AI_GO_PACKAGE,
  GENTLE_AI_INSTALL_SCRIPT_URL,
  formatCommandForDisplay,
  installHintForPlatform,
  planCommand,
} from "./argv.ts";

const plan = (request: GentleAiRunRequest, platform: NodeJS.Platform = "win32") =>
  planCommand(request, platform);

const gentleAiArgs = (request: GentleAiRunRequest, platform: NodeJS.Platform = "win32") => {
  const result = plan(request, platform);
  assert.strictEqual(result._tag, "gentleAi");
  return result._tag === "gentleAi" ? result.args : [];
};

const FULL_INSTALL: GentleAiRunRequest = {
  kind: "install",
  options: {
    agents: ["claude-code", "opencode"],
    components: ["engram", "sdd"],
    skills: ["sdd-apply", "judgment-day"],
    persona: "gentleman",
    preset: "custom",
    sddMode: "multi",
    scope: "workspace",
    channel: "beta",
    dryRun: false,
  },
};

it("builds a complete install command from the selected catalog entries", () => {
  assert.deepStrictEqual(gentleAiArgs(FULL_INSTALL), [
    "install",
    "--agents",
    "claude-code,opencode",
    "--components",
    "engram,sdd",
    "--skills",
    "sdd-apply,judgment-day",
    "--persona",
    "gentleman",
    "--preset",
    "custom",
    "--sdd-mode",
    "multi",
    "--scope",
    "workspace",
    "--channel",
    "beta",
  ]);
});

it("appends --dry-run only when the request asks for a preview", () => {
  assert.isFalse(gentleAiArgs(FULL_INSTALL).includes("--dry-run"));
  assert.isTrue(
    gentleAiArgs({
      kind: "install",
      options: { ...FULL_INSTALL.options, dryRun: true },
    }).includes("--dry-run"),
  );
});

it("omits empty list flags rather than passing an empty value", () => {
  const args = gentleAiArgs({
    kind: "install",
    options: { ...FULL_INSTALL.options, agents: [], components: [], skills: [] },
  });
  assert.isFalse(args.includes("--agents"));
  assert.isFalse(args.includes("--components"));
  assert.isFalse(args.includes("--skills"));
  assert.deepStrictEqual(args.slice(0, 3), ["install", "--persona", "gentleman"]);
});

it("builds a sync command from only the options that were supplied", () => {
  assert.deepStrictEqual(
    gentleAiArgs({
      kind: "sync",
      options: {
        agents: ["claude-code"],
        skills: ["sdd-verify"],
        sddMode: "single",
        strictTdd: true,
        includePermissions: true,
        includeTheme: false,
        dryRun: true,
      },
    }),
    [
      "sync",
      "--agents",
      "claude-code",
      "--skills",
      "sdd-verify",
      "--sdd-mode",
      "single",
      "--strict-tdd",
      "--include-permissions",
      "--dry-run",
    ],
  );
  assert.deepStrictEqual(gentleAiArgs({ kind: "sync", options: { dryRun: false } }), ["sync"]);
});

it("maps the simple commands to their CLI verbs", () => {
  assert.deepStrictEqual(gentleAiArgs({ kind: "upgrade" }), ["upgrade"]);
  assert.deepStrictEqual(gentleAiArgs({ kind: "update-check" }), ["update"]);
  assert.deepStrictEqual(gentleAiArgs({ kind: "doctor" }), ["doctor"]);
});

it("prefers --all over a partial agent list when uninstalling", () => {
  assert.deepStrictEqual(
    gentleAiArgs({ kind: "uninstall", options: { agents: ["codex"], all: true } }),
    ["uninstall", "--all"],
  );
  assert.deepStrictEqual(
    gentleAiArgs({ kind: "uninstall", options: { agents: ["codex", "cursor"] } }),
    ["uninstall", "--agents", "codex,cursor"],
  );
});

it("forces a skill registry refresh by default and pins the workspace as cwd", () => {
  const result = plan({
    kind: "skill-registry-refresh",
    options: { workspaceRoot: "E:/repo" },
  });
  assert.strictEqual(result._tag, "gentleAi");
  assert.deepStrictEqual(result._tag === "gentleAi" ? result.args : [], [
    "skill-registry",
    "refresh",
    "--cwd",
    "E:/repo",
    "--force",
  ]);
  assert.strictEqual(result.cwd, "E:/repo");

  assert.isFalse(
    gentleAiArgs({
      kind: "skill-registry-refresh",
      options: { workspaceRoot: "E:/repo", force: false },
    }).includes("--force"),
  );
});

it("builds the review mode toggle with its scope and optional clone path", () => {
  assert.deepStrictEqual(
    gentleAiArgs({
      kind: "review-mode",
      options: { action: "enable", scope: "clone", cwd: "E:/repo" },
    }),
    ["review", "mode", "enable", "--scope", "clone", "--cwd", "E:/repo"],
  );
  assert.deepStrictEqual(
    gentleAiArgs({ kind: "review-mode", options: { action: "disable", scope: "global" } }),
    ["review", "mode", "disable", "--scope", "global"],
  );
});

it("bootstraps the binary with go install on Windows and the script elsewhere", () => {
  const windows = plan({ kind: "install-binary" }, "win32");
  assert.strictEqual(windows._tag, "external");
  if (windows._tag === "external") {
    assert.strictEqual(windows.command, "go");
    assert.deepStrictEqual(windows.args, ["install", GENTLE_AI_GO_PACKAGE]);
  }

  const posix = plan({ kind: "install-binary" }, "darwin");
  assert.strictEqual(posix._tag, "external");
  if (posix._tag === "external") {
    assert.strictEqual(posix.command, "bash");
    assert.strictEqual(posix.args[0], "-c");
    assert.include(posix.args[1] ?? "", GENTLE_AI_INSTALL_SCRIPT_URL);
  }
});

it("reports a platform-appropriate install hint", () => {
  assert.include(installHintForPlatform("win32"), "go install");
  assert.include(installHintForPlatform("linux"), "curl -fsSL");
});

it("joins argv for display without quoting", () => {
  assert.strictEqual(
    formatCommandForDisplay("gentle-ai", ["review", "mode", "status"]),
    "gentle-ai review mode status",
  );
});
