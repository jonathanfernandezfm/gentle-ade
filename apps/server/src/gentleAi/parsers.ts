/**
 * Text parsers for the Gentle AI CLI.
 *
 * `doctor` and `update` print for humans, not for machines, so everything here
 * is deliberately tolerant: an unrecognised status token falls back to a value
 * derived from the data beside it, and a line that matches nothing is skipped
 * rather than failing the report. A new CLI release changing its layout should
 * degrade the panel, not take the hub down.
 *
 * @module gentleAi/parsers
 */
import type {
  GentleAiDoctorCheck,
  GentleAiDoctorReport,
  GentleAiDoctorStatus,
  GentleAiRddMode,
  GentleAiReviewModeState,
  GentleAiRiskAssessment,
  GentleAiRiskReason,
  GentleAiRiskTier,
  GentleAiSddStatus,
  GentleAiUpdateEntry,
  GentleAiUpdateReport,
  GentleAiUpdateStatus,
} from "@t3tools/contracts";

/** Strip ANSI escape sequences so parsing sees the plain text. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07/g, "");
}

const splitOutputLines = (text: string): ReadonlyArray<string> =>
  stripAnsi(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

// ── Versions ───────────────────────────────────────────────────

const VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/** `gentle-ai 3.0.2` / `engram 1.20.0` → `3.0.2` / `1.20.0`. */
export function parseVersionOutput(text: string): string | null {
  const match = VERSION_PATTERN.exec(stripAnsi(text));
  return match?.[1] ?? null;
}

// ── doctor ─────────────────────────────────────────────────────

const DOCTOR_CHECK_PATTERN = /^\s*\[(ok|warn|fail)\]\s+(\S+)\s*(.*)$/i;
const DOCTOR_SUMMARY_PATTERN =
  /^\s*Summary:\s*(\d+)\s+passed,\s*(\d+)\s+failed,\s*(\d+)\s+warnings?\s*$/i;
const DOCTOR_STATUS_PATTERN = /^\s*Status:\s*(\S+)/i;

export function parseDoctorReport(output: string): GentleAiDoctorReport {
  const raw = stripAnsi(output);
  const checks: Array<GentleAiDoctorCheck> = [];
  let summary: GentleAiDoctorReport["summary"] | null = null;
  let reportedStatus: string | null = null;

  for (const line of splitOutputLines(output)) {
    const summaryMatch = DOCTOR_SUMMARY_PATTERN.exec(line);
    if (summaryMatch) {
      summary = {
        passed: Number(summaryMatch[1]),
        failed: Number(summaryMatch[2]),
        warnings: Number(summaryMatch[3]),
      };
      continue;
    }

    const statusMatch = DOCTOR_STATUS_PATTERN.exec(line);
    if (statusMatch?.[1] !== undefined) {
      reportedStatus = statusMatch[1].toLowerCase();
      continue;
    }

    const checkMatch = DOCTOR_CHECK_PATTERN.exec(line);
    if (checkMatch?.[1] === undefined || checkMatch[2] === undefined) continue;
    checks.push({
      id: checkMatch[2],
      status: checkMatch[1].toLowerCase() as GentleAiDoctorStatus,
      detail: (checkMatch[3] ?? "").trim(),
    });
  }

  // Without a summary line, count the checks we did recognise: an older or
  // newer CLI that drops the footer still yields a usable panel.
  const resolvedSummary = summary ?? {
    passed: checks.filter((check) => check.status === "ok").length,
    failed: checks.filter((check) => check.status === "fail").length,
    warnings: checks.filter((check) => check.status === "warn").length,
  };

  return {
    checks,
    summary: resolvedSummary,
    healthy: reportedStatus === null ? resolvedSummary.failed === 0 : reportedStatus === "healthy",
    raw,
  };
}

// ── update ─────────────────────────────────────────────────────

const UPDATE_ROW_PATTERN = /^\s*\[([^\]]+)\]\s+(\S+)\s+installed:\s*(\S+)\s+latest:\s*(\S+)\s*$/i;

const readVersionCell = (cell: string): string | null => {
  const trimmed = cell.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
};

/**
 * Map the leading status token, and fall back to comparing the versions when
 * the token is one this build has not seen. Never trust the token alone: a
 * mislabelled row would otherwise hide a real update.
 */
const resolveUpdateStatus = (
  token: string,
  installed: string | null,
  latest: string | null,
): GentleAiUpdateStatus => {
  const normalized = token.trim().toLowerCase();
  if (normalized === "ok") return "ok";
  if (normalized === "--") return "missing";
  if (normalized === "!!" || normalized === "update") return "outdated";
  if (installed === null) return "missing";
  if (latest !== null && installed !== latest) return "outdated";
  return "ok";
};

export function parseUpdateReport(output: string): GentleAiUpdateReport {
  const entries: Array<GentleAiUpdateEntry> = [];

  for (const line of splitOutputLines(output)) {
    const match = UPDATE_ROW_PATTERN.exec(line);
    if (
      match?.[1] === undefined ||
      match[2] === undefined ||
      match[3] === undefined ||
      match[4] === undefined
    ) {
      continue;
    }
    const installed = readVersionCell(match[3]);
    const latest = readVersionCell(match[4]);
    entries.push({
      tool: match[2],
      installed,
      latest,
      status: resolveUpdateStatus(match[1], installed, latest),
    });
  }

  return {
    entries,
    // A `missing` row is an optional tool nobody installed, not an update the
    // user is behind on, so only `outdated` clears the up-to-date claim.
    upToDate: entries.every((entry) => entry.status !== "outdated"),
    raw: stripAnsi(output),
  };
}

// ── review assess ──────────────────────────────────────────────

const UNTRACKED_INVENTORY_PATTERN = /--expected-untracked-inventory=(sha256:[0-9a-f]+)/i;

/**
 * `review assess` refuses to look at a dirty tree until the caller declares the
 * untracked inventory, and names the expected digest in its own error. Pulling
 * it out here lets the service retry once instead of reporting a failure the
 * user cannot act on.
 */
export function extractUntrackedInventory(stderr: string): string | null {
  const match = UNTRACKED_INVENTORY_PATTERN.exec(stripAnsi(stderr));
  return match?.[1] ?? null;
}

// ── JSON payload readers ───────────────────────────────────────

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const asNonNegativeInt = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;

const asRddMode = (value: unknown): GentleAiRddMode => {
  const text = asString(value);
  return text === "on" || text === "off" ? text : "unknown";
};

/** `gentle-ai.review-mode/v1`, whose payload nests the state under `status`. */
export function parseReviewModeState(payload: unknown): GentleAiReviewModeState | null {
  const envelope = asRecord(payload);
  if (envelope === null) return null;
  const status = asRecord(envelope["status"]) ?? envelope;
  const global = status["global"];
  const effective = status["effective"];
  if (global === undefined && effective === undefined) return null;
  return {
    global: asRddMode(global),
    cloneLocal: asString(status["clone_local"]) ?? asString(status["cloneLocal"]) ?? "",
    effective: asRddMode(effective),
    source: asString(status["source"]) ?? "",
  };
}

const RISK_TIERS: ReadonlySet<string> = new Set(["passive", "medium", "high"]);

/** `gentle-ai.review-assessment/v1`. An unknown tier fails closed to `high`. */
export function parseRiskAssessment(payload: unknown): GentleAiRiskAssessment | null {
  const envelope = asRecord(payload);
  if (envelope === null) return null;
  const risk = asString(envelope["risk"]);
  if (risk === null) return null;

  const rawReasons = Array.isArray(envelope["reasons"]) ? envelope["reasons"] : [];
  const reasons: Array<GentleAiRiskReason> = [];
  for (const entry of rawReasons) {
    const reason = asRecord(entry);
    const code = asString(reason?.["code"]);
    if (reason === null || code === null) continue;
    const path = asString(reason["path"]);
    const detail = asString(reason["detail"]);
    reasons.push({
      code,
      ...(path === null ? {} : { path }),
      ...(detail === null ? {} : { detail }),
    });
  }

  return {
    risk: (RISK_TIERS.has(risk) ? risk : "high") as GentleAiRiskTier,
    reasons,
    changedPaths: asNonNegativeInt(envelope["changed_paths"] ?? envelope["changedPaths"]),
    changedLines: asNonNegativeInt(envelope["changed_lines"] ?? envelope["changedLines"]),
  };
}

/** `gentle-ai.sdd-status` v2. */
export function parseSddStatus(payload: unknown): GentleAiSddStatus | null {
  const envelope = asRecord(payload);
  if (envelope === null) return null;

  const artifacts: Record<string, string> = {};
  const rawArtifacts = asRecord(envelope["artifacts"]);
  if (rawArtifacts !== null) {
    for (const [name, state] of Object.entries(rawArtifacts)) {
      const text = asString(state);
      if (text !== null) artifacts[name] = text;
    }
  }

  const progress = asRecord(envelope["taskProgress"]) ?? asRecord(envelope["task_progress"]);
  const total = asNonNegativeInt(progress?.["total"]);
  const completed = asNonNegativeInt(progress?.["completed"]);

  return {
    changeName: asString(envelope["changeName"]) ?? asString(envelope["change_name"]),
    artifactStore:
      asString(envelope["artifactStore"]) ?? asString(envelope["artifact_store"]) ?? "",
    planningHomePath:
      asString(asRecord(envelope["planningHome"])?.["path"]) ??
      asString(asRecord(envelope["planning_home"])?.["path"]) ??
      "",
    artifacts,
    taskProgress: {
      total,
      completed,
      pending: asNonNegativeInt(progress?.["pending"]),
      allComplete: progress?.["allComplete"] === true || progress?.["all_complete"] === true,
    },
  };
}

// ── Markdown artifacts ─────────────────────────────────────────

const CHECKBOX_PATTERN = /^\s*[-*]\s+\[( |x)\]/i;

export interface OddTaskCounts {
  readonly total: number;
  readonly completed: number;
}

/** Count `- [ ]` / `- [x]` items in an ODD feature document. */
export function countOddTasks(markdown: string): OddTaskCounts {
  let total = 0;
  let completed = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const match = CHECKBOX_PATTERN.exec(line);
    if (match?.[1] === undefined) continue;
    total += 1;
    if (match[1].toLowerCase() === "x") completed += 1;
  }
  return { total, completed };
}

const SKILL_REGISTRY_ROW_PATTERN = /^\s*\|\s*`[^`]+`\s*\|/;

/**
 * Count the skills indexed in `.atl/skill-registry.md`. The generated table
 * quotes each skill name in backticks, which separates real rows from the
 * header and separator. Files this build cannot interpret fall back to counting
 * `SKILL.md` references, and only report `null` when neither shape appears.
 */
export function countSkillRegistryEntries(markdown: string): number | null {
  let rows = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (SKILL_REGISTRY_ROW_PATTERN.test(line)) rows += 1;
  }
  if (rows > 0) return rows;

  const references = markdown.match(/SKILL\.md/g);
  return references === null ? null : references.length;
}
