import { assert, it } from "@effect/vitest";

import {
  countOddTasks,
  countSkillRegistryEntries,
  extractUntrackedInventory,
  parseDoctorReport,
  parseReviewModeState,
  parseRiskAssessment,
  parseSddStatus,
  parseUpdateReport,
  parseVersionOutput,
  stripAnsi,
} from "./parsers.ts";

/** Verbatim `gentle-ai doctor` output from 3.0.2 on Windows. */
const DOCTOR_OUTPUT = [
  "gentle-ai doctor — system health check",
  "=======================================",
  "",
  "  [ok]  tool:gentle-ai                 gentle-ai found at C:\\go\\bin\\gentle-ai.exe (version 3.0.2)",
  "  [ok]  tool:engram                    engram found at C:\\engram\\bin\\engram.exe",
  "  [warn] state:json                    state file is older than the running binary",
  "  [fail] engram:reachable              engram MCP did not answer the initialize handshake",
  "",
  "Summary: 2 passed, 1 failed, 1 warnings",
  "Status:  unhealthy",
].join("\n");

/** Verbatim `gentle-ai update` output from 3.0.2. */
const UPDATE_OUTPUT = [
  "Update Check",
  "============",
  "",
  "  [ok] gentle-ai     installed: 3.0.2       latest: 3.0.2     ",
  "  [!!] engram        installed: 1.19.0      latest: 1.20.0    ",
  "  [--] opencode-sdd-engram-manage  installed: -           latest: 1.7.0     ",
  "",
  "All tools are up to date!",
].join("\n");

it("strips ANSI colouring before parsing", () => {
  assert.strictEqual(stripAnsi("\u001b[32m[ok]\u001b[0m ready"), "[ok] ready");
});

it("reads a version out of the CLI's --version line", () => {
  assert.strictEqual(parseVersionOutput("gentle-ai 3.0.2"), "3.0.2");
  assert.strictEqual(parseVersionOutput("engram 1.20.0\n"), "1.20.0");
  assert.strictEqual(parseVersionOutput("gentle-ai 3.1.0-rc.2"), "3.1.0-rc.2");
  assert.isNull(parseVersionOutput("command not found"));
});

it("parses every doctor check, its summary, and the reported status", () => {
  const report = parseDoctorReport(DOCTOR_OUTPUT);

  assert.deepStrictEqual(
    report.checks.map((check) => [check.id, check.status]),
    [
      ["tool:gentle-ai", "ok"],
      ["tool:engram", "ok"],
      ["state:json", "warn"],
      ["engram:reachable", "fail"],
    ],
  );
  assert.include(report.checks[0]?.detail ?? "", "version 3.0.2");
  assert.deepStrictEqual(report.summary, { passed: 2, failed: 1, warnings: 1 });
  assert.isFalse(report.healthy);
  assert.include(report.raw, "gentle-ai doctor");
});

it("treats a doctor report with a healthy status line as healthy", () => {
  const report = parseDoctorReport(
    [
      "  [ok]  disk:space   476295 MB free",
      "Summary: 1 passed, 0 failed, 0 warnings",
      "Status:  healthy",
    ].join("\n"),
  );
  assert.isTrue(report.healthy);
  assert.deepStrictEqual(report.summary, { passed: 1, failed: 0, warnings: 0 });
});

it("derives a doctor summary from the checks when the footer is missing", () => {
  const report = parseDoctorReport(["  [ok] a  fine", "  [fail] b  broken"].join("\n"));
  assert.deepStrictEqual(report.summary, { passed: 1, failed: 1, warnings: 0 });
  assert.isFalse(report.healthy);
});

it("parses the update table and classifies each row", () => {
  const report = parseUpdateReport(UPDATE_OUTPUT);

  assert.deepStrictEqual(report.entries, [
    { tool: "gentle-ai", installed: "3.0.2", latest: "3.0.2", status: "ok" },
    { tool: "engram", installed: "1.19.0", latest: "1.20.0", status: "outdated" },
    {
      tool: "opencode-sdd-engram-manage",
      installed: null,
      latest: "1.7.0",
      status: "missing",
    },
  ]);
  assert.isFalse(report.upToDate);
});

it("stays up to date when the only gap is an optional tool nobody installed", () => {
  const report = parseUpdateReport("  [--] gga  installed: -  latest: 2.10.1");
  assert.deepStrictEqual(
    report.entries.map((entry) => entry.status),
    ["missing"],
  );
  assert.isTrue(report.upToDate);
});

it("falls back to comparing versions when the status token is unfamiliar", () => {
  const report = parseUpdateReport("  [??] gga  installed: 2.9.0  latest: 2.10.1");
  assert.strictEqual(report.entries[0]?.status, "outdated");
});

it("extracts the untracked inventory digest review assess demands", () => {
  const stderr =
    "Error: untracked files require an explicit declaration; rerun with " +
    "--untracked-scope=exclude --expected-untracked-inventory=sha256:69b40ace87349b87 or " +
    "--untracked-scope=select";
  assert.strictEqual(extractUntrackedInventory(stderr), "sha256:69b40ace87349b87");
  assert.isNull(extractUntrackedInventory("Error: the candidate has no pending changes"));
});

it("parses the review mode envelope, including an unset clone override", () => {
  assert.deepStrictEqual(
    parseReviewModeState({
      schema: "gentle-ai.review-mode/v1",
      operation: "status",
      status: {
        schema: "gentle-ai.rdd-mode-status/v1",
        global: "on",
        clone_local: "",
        effective: "on",
        source: "global",
      },
    }),
    { global: "on", cloneLocal: "", effective: "on", source: "global" },
  );
  assert.isNull(parseReviewModeState({ schema: "gentle-ai.review-mode/v1" }));
  assert.isNull(parseReviewModeState("not an object"));
});

it("reports an unrecognised review mode as unknown rather than guessing", () => {
  const state = parseReviewModeState({ status: { global: "maybe", effective: "off" } });
  assert.strictEqual(state?.global, "unknown");
  assert.strictEqual(state?.effective, "off");
});

it("parses the risk assessment envelope", () => {
  assert.deepStrictEqual(
    parseRiskAssessment({
      schema: "gentle-ai.review-assessment/v1",
      risk: "high",
      reasons: [
        {
          code: "hot_path",
          path: "apps/server/src/auth/RpcAuthorization.ts",
          detail: "signal: auth",
        },
        { code: "process_boundary" },
        { not: "a reason" },
      ],
      changed_paths: 32,
      changed_lines: 229,
    }),
    {
      risk: "high",
      reasons: [
        {
          code: "hot_path",
          path: "apps/server/src/auth/RpcAuthorization.ts",
          detail: "signal: auth",
        },
        { code: "process_boundary" },
      ],
      changedPaths: 32,
      changedLines: 229,
    },
  );
});

it("fails an unknown risk tier closed to high", () => {
  assert.strictEqual(parseRiskAssessment({ risk: "catastrophic" })?.risk, "high");
  assert.isNull(parseRiskAssessment({ reasons: [] }));
});

it("parses the SDD status envelope", () => {
  assert.deepStrictEqual(
    parseSddStatus({
      schemaName: "gentle-ai.sdd-status",
      schemaVersion: 2,
      changeName: "gentle-ade-hub",
      artifactStore: "openspec",
      planningHome: { mode: "repo-local", path: "E:\\repo\\openspec" },
      artifacts: { proposal: "present", tasks: "missing", extra: 7 },
      taskProgress: { total: 4, completed: 1, pending: 3, allComplete: false },
    }),
    {
      changeName: "gentle-ade-hub",
      artifactStore: "openspec",
      planningHomePath: "E:\\repo\\openspec",
      artifacts: { proposal: "present", tasks: "missing" },
      taskProgress: { total: 4, completed: 1, pending: 3, allComplete: false },
    },
  );
});

it("parses an SDD status with no active change", () => {
  const status = parseSddStatus({
    changeName: null,
    artifactStore: "openspec",
    planningHome: { path: "E:\\repo\\openspec" },
    artifacts: {},
    taskProgress: { total: 0, completed: 0, pending: 0, allComplete: false },
  });
  assert.isNull(status?.changeName);
  assert.deepStrictEqual(status?.taskProgress, {
    total: 0,
    completed: 0,
    pending: 0,
    allComplete: false,
  });
});

it("counts ODD checkboxes in either state", () => {
  const document = [
    "## Tasks",
    "- [ ] T1 Toolchain",
    "- [x] T2 Contracts",
    "- [X] T3 Server",
    "* [ ] T4 Web",
    "  - [x] T4a nested",
    "- not a task",
    "- [] malformed",
  ].join("\n");
  assert.deepStrictEqual(countOddTasks(document), { total: 5, completed: 3 });
  assert.deepStrictEqual(countOddTasks(""), { total: 0, completed: 0 });
});

it("counts the backtick-quoted rows of a generated skill registry", () => {
  const registry = [
    "# Skill Registry — repo",
    "",
    "| Skill | Trigger / description | Scope | Path |",
    "| --- | --- | --- | --- |",
    "| `brainstorming` | Explore intent first. | user | `~/.agents/skills/brainstorming/SKILL.md` |",
    "| `chained-pr` | Split oversized changes. | user | `~/.agents/skills/chained-pr/SKILL.md` |",
  ].join("\n");
  assert.strictEqual(countSkillRegistryEntries(registry), 2);
});

it("falls back to counting SKILL.md references in an unfamiliar registry", () => {
  assert.strictEqual(countSkillRegistryEntries("- a/SKILL.md\n- b/SKILL.md\n- c/SKILL.md"), 3);
  assert.isNull(countSkillRegistryEntries("# Skill Registry\n\nNothing indexed yet."));
});
