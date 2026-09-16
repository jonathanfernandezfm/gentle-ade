/**
 * GentleAiService — the server half of the Gentle AI configuration hub.
 *
 * Gentle AI is a Go CLI plus a small set of files on disk. This service is the
 * only thing in the server that talks to either, and it exposes three kinds of
 * answer:
 *
 * - **Status** reads: where the binary and Engram live, and what
 *   `~/.gentle-ai/state.json` says is installed. Every probe degrades instead of
 *   failing, because "not installed" is the hub's most important screen.
 * - **Project** reads: review mode, SDD status, risk assessment, ODD task
 *   documents, the skill registry, and Engram presence for one workspace. Each
 *   sub-check is independent; a failure lands in `errors` and the rest of the
 *   panel still renders.
 * - **Command** runs: a closed set of argv shapes (see `./argv.ts`) spawned with
 *   a non-interactive environment and streamed back line by line.
 *
 * @module gentleAi/GentleAiService
 */
import {
  GentleAiBinaryNotFoundError,
  GentleAiCommandFailedError,
  type GentleAiBinaryStatus,
  type GentleAiCommandEvent,
  type GentleAiDoctorReport,
  type GentleAiEngramStatus,
  type GentleAiError,
  type GentleAiInstallState,
  type GentleAiOddTaskDocument,
  type GentleAiPlatform,
  type GentleAiProjectStatus,
  type GentleAiReviewModeOptions,
  type GentleAiReviewModeState,
  type GentleAiRunRequest,
  type GentleAiSkillRegistryState,
  type GentleAiStatus,
  type GentleAiUpdateReport,
} from "@t3tools/contracts";
import { HostProcessEnvironment, HostProcessPlatform } from "@t3tools/shared/hostProcess";
import { resolveCommandPath, resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

import { ProcessRunner } from "../processRunner.ts";
import {
  formatCommandForDisplay,
  installHintForPlatform,
  planCommand,
  reviewAssessArgs,
  reviewModeStatusArgs,
  sddStatusArgs,
} from "./argv.ts";
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
import { decodeGentleAiInstallState } from "./state.ts";

const GENTLE_AI_BINARY = "gentle-ai";
const ENGRAM_BINARY = "engram";
const STATE_DIRECTORY = ".gentle-ai";
const STATE_FILE = "state.json";
const SKILL_REGISTRY_RELATIVE_PATH = ".atl/skill-registry.md";

/** Probes must not hang the hub behind a wedged CLI. */
const PROBE_TIMEOUT: Duration.Input = "20 seconds";
/** Doctor and the update check contact the network, so they get longer. */
const REPORT_TIMEOUT: Duration.Input = "60 seconds";
/** `review assess` walks the whole worktree, so it gets the longest leash. */
const ASSESS_TIMEOUT: Duration.Input = "90 seconds";

/**
 * Environment for every spawn: answer prompts, never colour the output we are
 * about to parse, and never try to self-update mid-run.
 */
const NON_INTERACTIVE_ENV = {
  GENTLE_AI_YES: "1",
  CI: "1",
  NO_COLOR: "1",
  TERM: "dumb",
  GENTLE_AI_NO_SELF_UPDATE: "1",
} as const;

const KNOWN_PLATFORMS: ReadonlySet<string> = new Set(["win32", "darwin", "linux"]);

/** Platforms the hub renders. Anything else is reported as Linux-like. */
const asGentleAiPlatform = (platform: NodeJS.Platform): GentleAiPlatform =>
  KNOWN_PLATFORMS.has(platform) ? (platform as GentleAiPlatform) : "linux";

export class GentleAiService extends Context.Service<
  GentleAiService,
  {
    /** Binary, Engram, and decoded `~/.gentle-ai/state.json`. */
    readonly getStatus: Effect.Effect<GentleAiStatus, GentleAiError>;

    /** Review mode, SDD status, risk, ODD tasks, and registry for one workspace. */
    readonly getProjectStatus: (input: {
      readonly workspaceRoot: string;
    }) => Effect.Effect<GentleAiProjectStatus, GentleAiError>;

    readonly runDoctor: Effect.Effect<GentleAiDoctorReport, GentleAiError>;

    readonly checkUpdates: Effect.Effect<GentleAiUpdateReport, GentleAiError>;

    /** Run one allowed command, streaming its output line by line. */
    readonly runCommand: (
      request: GentleAiRunRequest,
    ) => Stream.Stream<GentleAiCommandEvent, GentleAiError>;

    /** Toggle receipt-driven development, returning the resulting state. */
    readonly setReviewMode: (
      options: GentleAiReviewModeOptions,
    ) => Effect.Effect<GentleAiReviewModeState | null, GentleAiError>;

    readonly refreshSkillRegistry: (input: {
      readonly workspaceRoot: string;
    }) => Effect.Effect<GentleAiSkillRegistryState, GentleAiError>;
  }
>()("t3/gentleAi/GentleAiService") {}

interface ResolvedBinary {
  readonly status: GentleAiBinaryStatus;
  readonly searchedPaths: ReadonlyArray<string>;
}

const parseJsonSafely = (text: string): unknown => {
  try {
    return JSON.parse(stripAnsi(text)) as unknown;
  } catch {
    return null;
  }
};

const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.fn("GentleAiService.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const processRunner = yield* ProcessRunner;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const homeDirectory = Effect.gen(function* () {
    const environment = yield* HostProcessEnvironment;
    return environment.HOME?.trim() || environment.USERPROFILE?.trim() || "";
  });

  const stateFilePath = Effect.gen(function* () {
    const home = yield* homeDirectory;
    return path.join(home, STATE_DIRECTORY, STATE_FILE);
  });

  /**
   * `resolveCommandPath` reads the filesystem through the context; everything
   * else in this service uses the services captured above, so the platform pair
   * is provided at exactly these call sites. Absence is the answer we want, so
   * a resolution failure becomes `null` rather than an error the caller must
   * thread through.
   */
  const resolveOnPath = (command: string, environment: NodeJS.ProcessEnv) =>
    resolveCommandPath(command, { env: environment }).pipe(
      Effect.map((resolved): string | null => resolved),
      Effect.orElseSucceed(() => null),
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );

  const existingFile = (candidate: string) =>
    fs.exists(candidate).pipe(
      Effect.map((exists) => (exists ? candidate : null)),
      Effect.orElseSucceed(() => null),
    );

  const firstExistingFile = (candidates: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      for (const candidate of candidates) {
        const found = yield* existingFile(candidate);
        if (found !== null) return found;
      }
      return null;
    });

  /**
   * Ask a binary for its version. A binary that exists but cannot answer is
   * still installed, so failures report `null` rather than un-installing it.
   */
  const readVersion = (executable: string) =>
    processRunner
      .run({
        command: executable,
        args: ["--version"],
        timeout: PROBE_TIMEOUT,
        outputMode: "truncate",
        timeoutBehavior: "timedOutResult",
      })
      .pipe(
        Effect.map((output) => parseVersionOutput(`${output.stdout}\n${output.stderr}`)),
        Effect.orElseSucceed(() => null),
      );

  /**
   * PATH first, then the Go bin directories, because `go install` is the
   * Windows install route and `~/go/bin` is frequently missing from PATH in a
   * GUI-launched process.
   */
  const resolveBinary = Effect.fn("GentleAiService.resolveBinary")(
    function* (): Effect.fn.Return<ResolvedBinary> {
      const platform = yield* HostProcessPlatform;
      const environment = yield* HostProcessEnvironment;
      const home = yield* homeDirectory;
      const installHint = installHintForPlatform(platform);
      const executableName = platform === "win32" ? `${GENTLE_AI_BINARY}.exe` : GENTLE_AI_BINARY;

      const goPath = environment.GOPATH?.trim();
      const goBinCandidates = [
        ...(home === "" ? [] : [path.join(home, "go", "bin", executableName)]),
        ...(goPath === undefined || goPath === ""
          ? []
          : [path.join(goPath, "bin", executableName)]),
      ];

      const onPath = yield* resolveOnPath(GENTLE_AI_BINARY, environment);
      if (onPath !== null) {
        return {
          status: {
            installed: true,
            path: onPath,
            version: yield* readVersion(onPath),
            source: "path",
            installHint,
          },
          searchedPaths: ["PATH", ...goBinCandidates],
        };
      }

      const inGoBin = yield* firstExistingFile(goBinCandidates);
      if (inGoBin !== null) {
        return {
          status: {
            installed: true,
            path: inGoBin,
            version: yield* readVersion(inGoBin),
            source: "go-bin",
            installHint,
          },
          searchedPaths: ["PATH", ...goBinCandidates],
        };
      }

      return {
        status: { installed: false, path: null, version: null, source: "not-found", installHint },
        searchedPaths: ["PATH", ...goBinCandidates],
      };
    },
  );

  const resolveEngram = Effect.fn("GentleAiService.resolveEngram")(
    function* (): Effect.fn.Return<GentleAiEngramStatus> {
      const environment = yield* HostProcessEnvironment;
      const home = yield* homeDirectory;
      const localAppData = environment.LOCALAPPDATA?.trim();

      const onPath = yield* resolveOnPath(ENGRAM_BINARY, environment);
      const resolved =
        onPath ??
        (yield* firstExistingFile([
          ...(localAppData === undefined || localAppData === ""
            ? []
            : [path.join(localAppData, "engram", "bin", "engram.exe")]),
          ...(home === "" ? [] : [path.join(home, ".local", "bin", ENGRAM_BINARY)]),
        ]));

      if (resolved === null) {
        return { installed: false, path: null, version: null };
      }
      return { installed: true, path: resolved, version: yield* readVersion(resolved) };
    },
  );

  const readInstallState = Effect.fn("GentleAiService.readInstallState")(
    function* (): Effect.fn.Return<{
      readonly present: boolean;
      readonly state: GentleAiInstallState | null;
    }> {
      const filePath = yield* stateFilePath;
      const contents = yield* fs.readFileString(filePath).pipe(
        Effect.map((text): string | null => text),
        Effect.orElseSucceed(() => null),
      );
      if (contents === null) return { present: false, state: null };
      const parsed = parseJsonSafely(contents);
      // A present-but-unreadable file is reported as present with no state: the
      // hub can then say "state file unreadable" instead of "not installed".
      if (parsed === null) return { present: true, state: null };
      return { present: true, state: decodeGentleAiInstallState(parsed) };
    },
  );

  const getStatus = Effect.gen(function* () {
    const platform = yield* HostProcessPlatform;
    const environment = yield* HostProcessEnvironment;
    const [binary, engram, state, filePath, goOnPath, checkedAt] = yield* Effect.all(
      [
        resolveBinary(),
        resolveEngram(),
        readInstallState(),
        stateFilePath,
        resolveOnPath("go", environment),
        DateTime.now,
      ],
      { concurrency: "unbounded" },
    );

    return {
      binary: binary.status,
      engram,
      state: state.state,
      stateFilePath: filePath,
      statePresent: state.present,
      platform: asGentleAiPlatform(platform),
      goAvailable: goOnPath !== null,
      checkedAt: DateTime.formatIso(checkedAt),
    } satisfies GentleAiStatus;
  });

  /** Resolve the binary or fail with the install hint the hub can display. */
  const requireBinary = Effect.gen(function* () {
    const resolved = yield* resolveBinary();
    if (resolved.status.path === null) {
      return yield* new GentleAiBinaryNotFoundError({
        searchedPaths: resolved.searchedPaths,
        installHint: resolved.status.installHint,
      });
    }
    return resolved.status.path;
  });

  /**
   * Run the CLI and hand back the raw result. Callers decide what a non-zero
   * exit means, because several commands report findings that way.
   */
  const runCli = Effect.fn("GentleAiService.runCli")(function* (input: {
    readonly executable: string;
    readonly args: ReadonlyArray<string>;
    readonly cwd?: string | undefined;
    readonly timeout?: Duration.Input | undefined;
  }) {
    const environment = yield* HostProcessEnvironment;
    const output = yield* processRunner
      .run({
        command: input.executable,
        args: input.args,
        ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
        env: { ...environment, ...NON_INTERACTIVE_ENV },
        timeout: input.timeout ?? PROBE_TIMEOUT,
        outputMode: "truncate",
        timeoutBehavior: "timedOutResult",
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new GentleAiCommandFailedError({
              command: formatCommandForDisplay(GENTLE_AI_BINARY, input.args),
              exitCode: null,
              stderr: cause.message,
            }),
        ),
      );
    return {
      stdout: stripAnsi(output.stdout),
      stderr: stripAnsi(output.stderr),
      exitCode: output.code === null ? null : Number(output.code),
      timedOut: output.timedOut,
    };
  });

  const runCliOrFail = Effect.fn("GentleAiService.runCliOrFail")(function* (input: {
    readonly executable: string;
    readonly args: ReadonlyArray<string>;
    readonly cwd?: string | undefined;
    readonly timeout?: Duration.Input | undefined;
  }) {
    const result = yield* runCli(input);
    if (result.exitCode !== 0) {
      return yield* new GentleAiCommandFailedError({
        command: formatCommandForDisplay(GENTLE_AI_BINARY, input.args),
        exitCode: result.exitCode,
        stderr: result.timedOut ? "The command timed out." : result.stderr,
      });
    }
    return result;
  });

  const runDoctor = Effect.gen(function* () {
    const executable = yield* requireBinary;
    // `doctor` exits non-zero when a check fails, which is a report rather than
    // a failure: parse the output either way.
    const result = yield* runCli({ executable, args: ["doctor"], timeout: REPORT_TIMEOUT });
    return parseDoctorReport(`${result.stdout}\n${result.stderr}`);
  });

  const checkUpdates = Effect.gen(function* () {
    const executable = yield* requireBinary;
    const result = yield* runCli({ executable, args: ["update"], timeout: REPORT_TIMEOUT });
    return parseUpdateReport(`${result.stdout}\n${result.stderr}`);
  });

  const readReviewMode = Effect.fn("GentleAiService.readReviewMode")(function* (
    executable: string,
    workspaceRoot: string,
  ) {
    const result = yield* runCliOrFail({
      executable,
      args: reviewModeStatusArgs(workspaceRoot),
      cwd: workspaceRoot,
    });
    return parseReviewModeState(parseJsonSafely(result.stdout));
  });

  const readSddStatus = Effect.fn("GentleAiService.readSddStatus")(function* (
    executable: string,
    workspaceRoot: string,
  ) {
    const result = yield* runCliOrFail({
      executable,
      args: sddStatusArgs(workspaceRoot),
      cwd: workspaceRoot,
    });
    return parseSddStatus(parseJsonSafely(result.stdout));
  });

  /**
   * `review assess` refuses a tree with undeclared untracked files and names the
   * inventory digest it wants in the error. Retry once with that digest; a
   * second failure is reported as-is (commonly "no pending changes", which is
   * information rather than a fault).
   */
  const readRiskAssessment = Effect.fn("GentleAiService.readRiskAssessment")(function* (
    executable: string,
    workspaceRoot: string,
  ) {
    const first = yield* runCli({
      executable,
      args: reviewAssessArgs(workspaceRoot),
      cwd: workspaceRoot,
      timeout: ASSESS_TIMEOUT,
    });
    if (first.exitCode === 0) {
      return { assessment: parseRiskAssessment(parseJsonSafely(first.stdout)), error: null };
    }

    const inventory = extractUntrackedInventory(first.stderr);
    if (inventory === null) {
      return { assessment: null, error: first.stderr.trim() || "review assess failed." };
    }

    const retry = yield* runCli({
      executable,
      args: reviewAssessArgs(workspaceRoot, inventory),
      cwd: workspaceRoot,
      timeout: ASSESS_TIMEOUT,
    });
    if (retry.exitCode === 0) {
      return { assessment: parseRiskAssessment(parseJsonSafely(retry.stdout)), error: null };
    }
    return { assessment: null, error: retry.stderr.trim() || "review assess failed." };
  });

  const readOddTaskDocuments = Effect.fn("GentleAiService.readOddTaskDocuments")(function* (
    workspaceRoot: string,
  ): Effect.fn.Return<ReadonlyArray<GentleAiOddTaskDocument>> {
    const directory = path.join(workspaceRoot, "odd", "tasks");
    const entries = yield* fs
      .readDirectory(directory)
      .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>));

    const documents: Array<GentleAiOddTaskDocument> = [];
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith(".md")) continue;
      const contents = yield* fs.readFileString(path.join(directory, entry)).pipe(
        Effect.map((text): string | null => text),
        Effect.orElseSucceed(() => null),
      );
      if (contents === null) continue;
      const counts = countOddTasks(contents);
      documents.push({
        name: entry.replace(/\.md$/i, ""),
        path: `odd/tasks/${entry}`,
        total: counts.total,
        completed: counts.completed,
      });
    }
    return documents;
  });

  const readOpenspecChanges = Effect.fn("GentleAiService.readOpenspecChanges")(function* (
    workspaceRoot: string,
  ): Effect.fn.Return<ReadonlyArray<string>> {
    const directory = path.join(workspaceRoot, "openspec", "changes");
    const entries = yield* fs
      .readDirectory(directory)
      .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>));

    const changes: Array<string> = [];
    for (const entry of entries) {
      // `archive` holds closed changes; the hub lists the open ones.
      if (entry === "archive") continue;
      const info = yield* fs.stat(path.join(directory, entry)).pipe(
        Effect.map((stat): string | null => stat.type),
        Effect.orElseSucceed(() => null),
      );
      if (info === "Directory") changes.push(entry);
    }
    return changes;
  });

  const readSkillRegistry = Effect.fn("GentleAiService.readSkillRegistry")(function* (
    workspaceRoot: string,
  ): Effect.fn.Return<GentleAiSkillRegistryState> {
    const absolutePath = path.join(workspaceRoot, ".atl", "skill-registry.md");
    const contents = yield* fs.readFileString(absolutePath).pipe(
      Effect.map((text): string | null => text),
      Effect.orElseSucceed(() => null),
    );
    if (contents === null) {
      return {
        present: false,
        path: SKILL_REGISTRY_RELATIVE_PATH,
        skillCount: null,
        updatedAt: null,
      };
    }

    const modifiedAt = yield* fs.stat(absolutePath).pipe(
      Effect.map((stat) => Option.getOrNull(stat.mtime)),
      Effect.orElseSucceed(() => null),
    );
    return {
      present: true,
      path: SKILL_REGISTRY_RELATIVE_PATH,
      skillCount: countSkillRegistryEntries(contents),
      updatedAt: modifiedAt === null ? null : modifiedAt.toISOString(),
    };
  });

  const getProjectStatus = Effect.fn("GentleAiService.getProjectStatus")(function* (input: {
    readonly workspaceRoot: string;
  }) {
    const workspaceRoot = input.workspaceRoot;
    const errors: Array<string> = [];
    const recordError = (label: string, cause: unknown) => {
      errors.push(`${label}: ${describeFailure(cause)}`);
    };

    const [isGitRepo, oddTasks, openspecChanges, skillRegistry, engramPresent] = yield* Effect.all(
      [
        fs.exists(path.join(workspaceRoot, ".git")).pipe(Effect.orElseSucceed(() => false)),
        readOddTaskDocuments(workspaceRoot),
        readOpenspecChanges(workspaceRoot),
        readSkillRegistry(workspaceRoot),
        fs.exists(path.join(workspaceRoot, ".engram")).pipe(Effect.orElseSucceed(() => false)),
      ],
      { concurrency: "unbounded" },
    );

    // Every CLI sub-check needs the binary. Without it the filesystem answers
    // above are still worth showing, so this is not an error.
    const resolved = yield* resolveBinary();
    const executable = resolved.status.path;
    if (executable === null) {
      return {
        workspaceRoot,
        isGitRepo,
        reviewMode: null,
        sddStatus: null,
        riskAssessment: null,
        riskAssessmentError: null,
        oddTasks,
        openspecChanges,
        skillRegistry,
        engramPresent,
        errors,
      } satisfies GentleAiProjectStatus;
    }

    const [reviewMode, sddStatus, risk] = yield* Effect.all(
      [
        readReviewMode(executable, workspaceRoot).pipe(
          Effect.catch((cause) => {
            recordError("review mode status", cause);
            return Effect.succeed(null);
          }),
        ),
        readSddStatus(executable, workspaceRoot).pipe(
          Effect.catch((cause) => {
            recordError("sdd-status", cause);
            return Effect.succeed(null);
          }),
        ),
        readRiskAssessment(executable, workspaceRoot).pipe(
          Effect.catch((cause) => {
            recordError("review assess", cause);
            return Effect.succeed({
              assessment: null,
              error: describeFailure(cause),
            } as const);
          }),
        ),
      ],
      { concurrency: "unbounded" },
    );

    return {
      workspaceRoot,
      isGitRepo,
      reviewMode,
      sddStatus,
      riskAssessment: risk.assessment,
      riskAssessmentError: risk.error,
      oddTasks,
      openspecChanges,
      skillRegistry,
      engramPresent,
      errors,
    } satisfies GentleAiProjectStatus;
  });

  const setReviewMode = Effect.fn("GentleAiService.setReviewMode")(function* (
    options: GentleAiReviewModeOptions,
  ) {
    const executable = yield* requireBinary;
    const plan = planCommand({ kind: "review-mode", options }, yield* HostProcessPlatform);
    yield* runCliOrFail({
      executable,
      args: plan.args,
      ...(plan.cwd === undefined ? {} : { cwd: plan.cwd }),
    });
    // Read the mode back rather than inferring it from the action: a clone-local
    // enable does not change the effective mode when global is off.
    const workspaceRoot = options.cwd;
    if (workspaceRoot === undefined) return null;
    return yield* readReviewMode(executable, workspaceRoot);
  });

  const refreshSkillRegistry = Effect.fn("GentleAiService.refreshSkillRegistry")(function* (input: {
    readonly workspaceRoot: string;
  }) {
    const executable = yield* requireBinary;
    const plan = planCommand(
      { kind: "skill-registry-refresh", options: { workspaceRoot: input.workspaceRoot } },
      yield* HostProcessPlatform,
    );
    yield* runCliOrFail({
      executable,
      args: plan.args,
      cwd: input.workspaceRoot,
      timeout: REPORT_TIMEOUT,
    });
    return yield* readSkillRegistry(input.workspaceRoot);
  });

  /**
   * Spawn one planned command and publish its output as it arrives. stdin is
   * closed so a CLI that still wants an answer fails fast instead of hanging a
   * fiber the user cannot see.
   */
  const runCommand = (
    request: GentleAiRunRequest,
  ): Stream.Stream<GentleAiCommandEvent, GentleAiError> =>
    Stream.callback<GentleAiCommandEvent, GentleAiError>((queue) =>
      Effect.gen(function* () {
        const platform = yield* HostProcessPlatform;
        const environment = yield* HostProcessEnvironment;
        const plan = planCommand(request, platform);
        const executable = plan._tag === "gentleAi" ? yield* requireBinary : plan.command;
        // Display the bare command name rather than the resolved absolute path:
        // the console is a transcript for the user, not a reproduction script.
        const display = formatCommandForDisplay(
          plan._tag === "gentleAi" ? GENTLE_AI_BINARY : plan.command,
          plan.args,
        );

        yield* Queue.offer(queue, { _tag: "started", command: display });
        const startedAtMs = yield* Clock.currentTimeMillis;

        const env = { ...environment, ...NON_INTERACTIVE_ENV };
        const spawnCommand = yield* resolveSpawnCommand(executable, plan.args, {
          env,
          extendEnv: true,
        });
        const child = yield* spawner
          .spawn(
            ChildProcess.make(spawnCommand.command, spawnCommand.args, {
              ...(plan.cwd === undefined ? {} : { cwd: plan.cwd }),
              env,
              extendEnv: true,
              shell: spawnCommand.shell,
              stdin: "ignore",
            }),
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new GentleAiCommandFailedError({
                  command: display,
                  exitCode: null,
                  stderr: describeFailure(cause),
                }),
            ),
          );

        const pump = (
          source: typeof child.stdout,
          streamName: "stdout" | "stderr",
        ): Effect.Effect<void, GentleAiError> =>
          source.pipe(
            Stream.decodeText(),
            Stream.splitLines,
            Stream.runForEach((line) =>
              Queue.offer(queue, {
                _tag: "output" as const,
                stream: streamName,
                line: stripAnsi(line),
              }),
            ),
            Effect.mapError(
              (cause) =>
                new GentleAiCommandFailedError({
                  command: display,
                  exitCode: null,
                  stderr: describeFailure(cause),
                }),
            ),
          );

        yield* Effect.all([pump(child.stdout, "stdout"), pump(child.stderr, "stderr")], {
          concurrency: "unbounded",
        });

        const exitCode = yield* child.exitCode.pipe(
          Effect.mapError(
            (cause) =>
              new GentleAiCommandFailedError({
                command: display,
                exitCode: null,
                stderr: describeFailure(cause),
              }),
          ),
        );
        const finishedAtMs = yield* Clock.currentTimeMillis;

        // A non-zero exit is reported in the event rather than as a stream
        // failure: the console already holds the output explaining it, and the
        // hub wants to show the transcript plus the code.
        yield* Queue.offer(queue, {
          _tag: "exited",
          exitCode: Number(exitCode),
          durationMs: Math.max(0, finishedAtMs - startedAtMs),
        });
        yield* Queue.end(queue);
      }),
    );

  return GentleAiService.of({
    getStatus,
    getProjectStatus,
    runDoctor,
    checkUpdates,
    runCommand,
    setReviewMode,
    refreshSkillRegistry,
  });
});

export const layer = Layer.effect(GentleAiService, make());
