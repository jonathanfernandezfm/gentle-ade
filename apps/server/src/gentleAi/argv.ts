/**
 * Argv construction for the Gentle AI hub.
 *
 * The client sends a {@link GentleAiRunRequest} from a closed union; this module
 * is the only place that turns one into a command line. Nothing here reads
 * free-form strings from the request except workspace paths, so the hub can
 * never be used to run an arbitrary command.
 *
 * @module gentleAi/argv
 */
import type { GentleAiRunRequest } from "@t3tools/contracts";

/** The Go module path used by the Windows install route. */
export const GENTLE_AI_GO_PACKAGE =
  "github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@latest";

/** The POSIX install script, piped into bash exactly as the project documents it. */
export const GENTLE_AI_INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh";

export const GENTLE_AI_WINDOWS_INSTALL_HINT = `go install ${GENTLE_AI_GO_PACKAGE}`;
export const GENTLE_AI_POSIX_INSTALL_HINT = `curl -fsSL ${GENTLE_AI_INSTALL_SCRIPT_URL} | bash`;

export function installHintForPlatform(platform: NodeJS.Platform): string {
  return platform === "win32" ? GENTLE_AI_WINDOWS_INSTALL_HINT : GENTLE_AI_POSIX_INSTALL_HINT;
}

/**
 * A resolved command line. `gentleAi` runs the resolved `gentle-ai` binary;
 * `external` bootstraps that binary and therefore cannot depend on it.
 */
export type GentleAiCommandPlan =
  | {
      readonly _tag: "gentleAi";
      readonly args: ReadonlyArray<string>;
      readonly cwd: string | undefined;
    }
  | {
      readonly _tag: "external";
      readonly command: string;
      readonly args: ReadonlyArray<string>;
      readonly cwd: string | undefined;
    };

const listFlag = (
  flag: string,
  values: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> =>
  values === undefined || values.length === 0 ? [] : [flag, values.join(",")];

const booleanFlag = (flag: string, enabled: boolean | undefined): ReadonlyArray<string> =>
  enabled === true ? [flag] : [];

const valueFlag = (flag: string, value: string | undefined): ReadonlyArray<string> =>
  value === undefined ? [] : [flag, value];

/**
 * The bootstrap command for a host without the binary. Windows uses `go install`
 * because the project ships no Windows installer script; everything else pipes
 * the published install script into bash.
 */
export function planBinaryInstall(platform: NodeJS.Platform): GentleAiCommandPlan {
  if (platform === "win32") {
    return {
      _tag: "external",
      command: "go",
      args: ["install", GENTLE_AI_GO_PACKAGE],
      cwd: undefined,
    };
  }
  return {
    _tag: "external",
    command: "bash",
    args: ["-c", `curl -fsSL ${GENTLE_AI_INSTALL_SCRIPT_URL} | bash`],
    cwd: undefined,
  };
}

export function planCommand(
  request: GentleAiRunRequest,
  platform: NodeJS.Platform,
): GentleAiCommandPlan {
  switch (request.kind) {
    case "install": {
      const options = request.options;
      return {
        _tag: "gentleAi",
        args: [
          "install",
          ...listFlag("--agents", options.agents),
          ...listFlag("--components", options.components),
          ...listFlag("--skills", options.skills),
          "--persona",
          options.persona,
          "--preset",
          options.preset,
          "--sdd-mode",
          options.sddMode,
          "--scope",
          options.scope,
          "--channel",
          options.channel,
          ...booleanFlag("--dry-run", options.dryRun),
        ],
        cwd: undefined,
      };
    }
    case "sync": {
      const options = request.options;
      return {
        _tag: "gentleAi",
        args: [
          "sync",
          ...listFlag("--agents", options.agents),
          ...listFlag("--skills", options.skills),
          ...valueFlag("--sdd-mode", options.sddMode),
          ...booleanFlag("--strict-tdd", options.strictTdd),
          ...booleanFlag("--include-permissions", options.includePermissions),
          ...booleanFlag("--include-theme", options.includeTheme),
          ...booleanFlag("--dry-run", options.dryRun),
        ],
        cwd: undefined,
      };
    }
    case "upgrade":
      return { _tag: "gentleAi", args: ["upgrade"], cwd: undefined };
    case "update-check":
      return { _tag: "gentleAi", args: ["update"], cwd: undefined };
    case "doctor":
      return { _tag: "gentleAi", args: ["doctor"], cwd: undefined };
    case "uninstall": {
      const options = request.options;
      // `--all` and `--agents` are mutually exclusive; `--all` is the stronger
      // request, so it wins when a client somehow sends both.
      return {
        _tag: "gentleAi",
        args:
          options.all === true
            ? ["uninstall", "--all"]
            : ["uninstall", ...listFlag("--agents", options.agents)],
        cwd: undefined,
      };
    }
    case "skill-registry-refresh": {
      const options = request.options;
      // The cache fast path would make the hub's refresh button look broken on
      // an unchanged tree, so a manual refresh forces regeneration by default.
      const force = options.force ?? true;
      return {
        _tag: "gentleAi",
        args: [
          "skill-registry",
          "refresh",
          "--cwd",
          options.workspaceRoot,
          ...booleanFlag("--force", force),
        ],
        cwd: options.workspaceRoot,
      };
    }
    case "review-mode": {
      const options = request.options;
      return {
        _tag: "gentleAi",
        args: [
          "review",
          "mode",
          options.action,
          "--scope",
          options.scope,
          ...valueFlag("--cwd", options.cwd),
        ],
        cwd: options.cwd,
      };
    }
    case "install-binary":
      return planBinaryInstall(platform);
  }
}

/** Read-only probes the service runs itself; never built from client input. */
export const reviewModeStatusArgs = (workspaceRoot: string): ReadonlyArray<string> => [
  "review",
  "mode",
  "status",
  "--cwd",
  workspaceRoot,
  "--json",
];

export const sddStatusArgs = (workspaceRoot: string): ReadonlyArray<string> => [
  "sdd-status",
  "--cwd",
  workspaceRoot,
  "--json",
];

export const reviewAssessArgs = (
  workspaceRoot: string,
  untrackedInventory?: string,
): ReadonlyArray<string> => [
  "review",
  "assess",
  "--cwd",
  workspaceRoot,
  "--json",
  ...(untrackedInventory === undefined
    ? []
    : ["--untracked-scope=exclude", `--expected-untracked-inventory=${untrackedInventory}`]),
];

/** Joined argv for the console's `started` event. Display only. */
export function formatCommandForDisplay(command: string, args: ReadonlyArray<string>): string {
  return [command, ...args].join(" ");
}
