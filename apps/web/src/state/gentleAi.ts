/**
 * Gentle AI hub state.
 *
 * The hub reads one environment at a time -- the primary one, the same machine
 * Settings > Providers configures -- because `~/.gentle-ai/state.json` and the
 * `gentle-ai` binary are properties of a host, not of the client.
 *
 * Status and per-project status are cached queries. Doctor, update checks, and
 * the review-mode toggle are commands, so nothing spawns a CLI process merely
 * because a section scrolled into view. `gentleAiRunCommand` is a streaming
 * command: it drives the console atom and is single-flighted, because the CLI
 * mutates shared state on disk and two concurrent installs would race.
 *
 * @module state/gentleAi
 */
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  WS_METHODS,
  type EnvironmentId,
  type GentleAiProjectStatus,
  type GentleAiRunRequest,
  type GentleAiStatus,
} from "@t3tools/contracts";
import { runStream } from "@t3tools/client-runtime/rpc";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createRuntimeCommand,
  runStreamInEnvironment,
} from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";
import { useCallback, useMemo } from "react";

import {
  appendConsoleEvent,
  beginConsoleRun,
  EMPTY_GENTLE_AI_CONSOLE,
  failConsoleRun,
  type GentleAiConsoleState,
} from "../components/gentle-ai/gentleAi.logic";
import { connectionAtomRuntime } from "../connection/runtime";
import { usePrimaryEnvironmentId } from "./environments";
import { useEnvironmentQuery, type EnvironmentQueryView } from "./query";
import { useAtomCommand } from "./use-atom-command";

export const gentleAiStatusQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:gentle-ai:status",
  tag: WS_METHODS.gentleAiGetStatus,
  staleTimeMs: 10_000,
  idleTtlMs: 120_000,
});

export const gentleAiProjectStatusQuery = createEnvironmentRpcQueryAtomFamily(
  connectionAtomRuntime,
  {
    label: "environment-data:gentle-ai:project-status",
    tag: WS_METHODS.gentleAiGetProjectStatus,
    staleTimeMs: 10_000,
    idleTtlMs: 120_000,
  },
);

export const gentleAiDoctorCommand = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "gentle-ai:doctor",
  tag: WS_METHODS.gentleAiRunDoctor,
  concurrency: { mode: "singleFlight", key: (target) => target.environmentId },
});

export const gentleAiUpdateCheckCommand = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "gentle-ai:check-updates",
  tag: WS_METHODS.gentleAiCheckUpdates,
  concurrency: { mode: "singleFlight", key: (target) => target.environmentId },
});

export const gentleAiSetReviewModeCommand = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "gentle-ai:set-review-mode",
  tag: WS_METHODS.gentleAiSetReviewMode,
  concurrency: { mode: "serial", key: (target) => target.environmentId },
});

export const gentleAiRefreshSkillRegistryCommand = createEnvironmentRpcCommand(
  connectionAtomRuntime,
  {
    label: "gentle-ai:refresh-skill-registry",
    tag: WS_METHODS.gentleAiRefreshSkillRegistry,
    concurrency: { mode: "singleFlight", key: (target) => target.environmentId },
  },
);

/**
 * The live console. One per client: the hub only ever runs one command at a
 * time, so a second buffer would only ever be an empty one.
 */
export const gentleAiConsoleAtom = Atom.make(EMPTY_GENTLE_AI_CONSOLE).pipe(
  Atom.keepAlive,
  Atom.withLabel("web-gentle-ai:console"),
);

/** Stands in for a status query that has no environment to refresh. */
const NOOP_REFRESH_ATOM = Atom.make(null).pipe(Atom.withLabel("web-gentle-ai:noop-refresh"));

function describeFailure(cause: Cause.Cause<unknown>): string {
  const error = Cause.squash(cause);
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The Gentle AI command could not be started.";
}

/**
 * Runs one CLI command and streams its output into the console atom. It never
 * fails: a non-zero exit and a transport failure are both console states the
 * user reads, not errors a caller has to catch.
 */
export const gentleAiRunCommand = createRuntimeCommand(connectionAtomRuntime, {
  label: "gentle-ai:run-command",
  concurrency: { mode: "singleFlight", key: () => "gentle-ai:run-command" },
  execute: (
    target: { readonly environmentId: EnvironmentId; readonly input: GentleAiRunRequest },
    registry,
  ) =>
    Effect.gen(function* () {
      registry.set(gentleAiConsoleAtom, beginConsoleRun(target.input.kind));
      const exit = yield* runStreamInEnvironment(
        target.environmentId,
        runStream(WS_METHODS.gentleAiRunCommand, target.input),
      ).pipe(
        Stream.runForEach((event) =>
          Effect.sync(() => {
            registry.set(
              gentleAiConsoleAtom,
              appendConsoleEvent(registry.get(gentleAiConsoleAtom), event),
            );
          }),
        ),
        Effect.exit,
      );
      if (Exit.isFailure(exit)) {
        registry.set(
          gentleAiConsoleAtom,
          failConsoleRun(registry.get(gentleAiConsoleAtom), describeFailure(exit.cause)),
        );
      }
      return registry.get(gentleAiConsoleAtom);
    }),
});

/** Install status for the primary environment. */
export function useGentleAiStatus(): EnvironmentQueryView<GentleAiStatus> {
  const environmentId = usePrimaryEnvironmentId();
  const atom = useMemo(
    () => (environmentId === null ? null : gentleAiStatusQuery({ environmentId, input: {} })),
    [environmentId],
  );
  return useEnvironmentQuery(atom);
}

/** Per-workspace status; `null` workspace keeps the query unmounted. */
export function useGentleAiProjectStatus(
  workspaceRoot: string | null,
): EnvironmentQueryView<GentleAiProjectStatus> {
  const environmentId = usePrimaryEnvironmentId();
  const atom = useMemo(
    () =>
      environmentId === null || workspaceRoot === null || workspaceRoot.trim().length === 0
        ? null
        : gentleAiProjectStatusQuery({ environmentId, input: { workspaceRoot } }),
    [environmentId, workspaceRoot],
  );
  return useEnvironmentQuery(atom);
}

export interface GentleAiConsoleController {
  readonly state: GentleAiConsoleState;
  readonly isRunning: boolean;
  readonly clear: () => void;
}

export function useGentleAiConsole(): GentleAiConsoleController {
  const state = useAtomValue(gentleAiConsoleAtom);
  const setConsole = useAtomSet(gentleAiConsoleAtom);
  const clear = useCallback(() => setConsole(EMPTY_GENTLE_AI_CONSOLE), [setConsole]);
  return { state, isRunning: state.status === "running", clear };
}

export interface GentleAiRunner {
  readonly run: (request: GentleAiRunRequest) => Promise<GentleAiConsoleState | null>;
  readonly isRunning: boolean;
  readonly isAvailable: boolean;
}

/**
 * Runs a command against the primary environment and refreshes the install
 * status afterwards, because every command in the closed union can change it.
 */
export function useGentleAiRunner(): GentleAiRunner {
  const environmentId = usePrimaryEnvironmentId();
  const { isRunning } = useGentleAiConsole();
  const execute = useAtomCommand(gentleAiRunCommand, { reportFailure: false });
  const statusAtom = useMemo(
    () => (environmentId === null ? null : gentleAiStatusQuery({ environmentId, input: {} })),
    [environmentId],
  );
  // `useAtomRefresh` needs an atom on every render; without an environment there
  // is no status query to invalidate, so it points at an inert placeholder.
  const refreshStatus = useAtomRefresh(statusAtom ?? NOOP_REFRESH_ATOM);

  const run = useCallback(
    async (request: GentleAiRunRequest) => {
      if (environmentId === null) return null;
      const result = await execute({ environmentId, input: request });
      refreshStatus();
      return result._tag === "Success" ? result.value : null;
    },
    [environmentId, execute, refreshStatus],
  );

  return { run, isRunning, isAvailable: environmentId !== null };
}
