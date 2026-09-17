import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { HostProcessEnvironment } from "@t3tools/shared/hostProcess";
import { CommandResolutionCache } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { ProcessRunner } from "../processRunner.ts";
import * as GentleAiServiceModule from "./GentleAiService.ts";

/**
 * Nothing in these tests may probe the developer's own machine. `gentle-ai`,
 * `engram`, and `go` are all looked up through `HostProcessEnvironment`, which
 * is a `Context.Reference` resolved when the effect runs rather than when the
 * layer is built — so the scratch environment is merged into the output context
 * too, not only provided to the layer. The command-resolution cache is
 * isolated for the same reason: its default is process-wide.
 */
const makeTestLayer = (home: string) => {
  const hostLayer = Layer.mergeAll(
    Layer.succeed(HostProcessEnvironment, { PATH: "", HOME: home, USERPROFILE: home }),
    Layer.succeed(CommandResolutionCache, new Map()),
  );
  return GentleAiServiceModule.layer.pipe(
    Layer.provide(
      Layer.mock(ProcessRunner)({
        run: (input) =>
          Effect.die(new Error(`No process should be spawned in this test: ${input.command}`)),
      }),
    ),
    Layer.provideMerge(hostLayer),
    Layer.provideMerge(NodeServices.layer),
  );
};

const withService = <A, E>(
  body: (
    service: GentleAiServiceModule.GentleAiService["Service"],
    home: string,
  ) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const home = yield* fs.makeTempDirectoryScoped({ prefix: "t3-gentle-ai-" });
    return yield* Effect.gen(function* () {
      const service = yield* GentleAiServiceModule.GentleAiService;
      return yield* body(service, home);
    }).pipe(Effect.provide(makeTestLayer(home)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

it.effect("reports a missing binary with an actionable install hint", () =>
  withService((service) =>
    Effect.gen(function* () {
      const status = yield* service.getStatus;

      assert.isFalse(status.binary.installed);
      assert.isNull(status.binary.path);
      assert.strictEqual(status.binary.source, "not-found");
      assert.isNotEmpty(status.binary.installHint);
      assert.isFalse(status.engram.installed);
      assert.isFalse(status.statePresent);
      assert.isNull(status.state);
      assert.isFalse(status.goAvailable);
      assert.include(status.stateFilePath, ".gentle-ai");
      assert.match(status.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
    }),
  ),
);

it.effect("decodes the state file when one is present", () =>
  withService((service, home) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.join(home, ".gentle-ai"), { recursive: true });
      yield* fs.writeFileString(
        path.join(home, ".gentle-ai", "state.json"),
        // Written verbatim rather than serialised: this is the CLI's file
        // format, so the test should read like the bytes on disk.
        `{
  "installed_agents": ["claude-code"],
  "persona": "gentleman",
  "rdd_mode": "on",
  "claude_phase_assignments": { "default": { "model": "sonnet" } }
}
`,
      );

      const status = yield* service.getStatus;
      assert.isTrue(status.statePresent);
      assert.deepStrictEqual(status.state?.installedAgents, ["claude-code"]);
      assert.strictEqual(status.state?.persona, "gentleman");
      assert.deepStrictEqual(status.state?.claudePhaseAssignments, { default: "sonnet" });
    }),
  ),
);

it.effect("reports a present but unparseable state file as present with no state", () =>
  withService((service, home) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.join(home, ".gentle-ai"), { recursive: true });
      yield* fs.writeFileString(path.join(home, ".gentle-ai", "state.json"), "{ not json");

      const status = yield* service.getStatus;
      assert.isTrue(status.statePresent);
      assert.isNull(status.state);
    }),
  ),
);

it.effect("reads the filesystem half of a project status without the CLI", () =>
  withService((service, home) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const workspaceRoot = path.join(home, "repo");

      yield* fs.makeDirectory(path.join(workspaceRoot, "odd", "tasks"), { recursive: true });
      yield* fs.writeFileString(
        path.join(workspaceRoot, "odd", "tasks", "hub.md"),
        "## Tasks\n- [x] T1 done\n- [ ] T2 pending\n",
      );
      yield* fs.makeDirectory(path.join(workspaceRoot, "openspec", "changes", "add-hub"), {
        recursive: true,
      });
      yield* fs.makeDirectory(path.join(workspaceRoot, "openspec", "changes", "archive"), {
        recursive: true,
      });
      yield* fs.writeFileString(
        path.join(workspaceRoot, "openspec", "config.yaml"),
        "artifact_store: openspec\n",
      );
      yield* fs.makeDirectory(path.join(workspaceRoot, ".atl"), { recursive: true });
      yield* fs.writeFileString(
        path.join(workspaceRoot, ".atl", "skill-registry.md"),
        "| Skill | Trigger | Scope | Path |\n| --- | --- | --- | --- |\n| `go-testing` | Go tests | user | `x/SKILL.md` |\n",
      );
      yield* fs.makeDirectory(path.join(workspaceRoot, ".engram"), { recursive: true });

      const status = yield* service.getProjectStatus({ workspaceRoot });

      assert.strictEqual(status.workspaceRoot, workspaceRoot);
      assert.isFalse(status.isGitRepo);
      assert.deepStrictEqual(status.oddTasks, [
        { name: "hub", path: "odd/tasks/hub.md", total: 2, completed: 1 },
      ]);
      assert.deepStrictEqual(status.openspecChanges, ["add-hub"]);
      assert.isTrue(status.skillRegistry.present);
      assert.strictEqual(status.skillRegistry.skillCount, 1);
      assert.isNotNull(status.skillRegistry.updatedAt);
      assert.isTrue(status.openspecConfigPresent);
      assert.isTrue(status.engramPresent);
      // Without the binary the CLI sub-checks are skipped rather than failed:
      // an uninstalled Gentle AI is not a project error.
      assert.isNull(status.reviewMode);
      assert.isNull(status.sddStatus);
      assert.isNull(status.riskAssessment);
      assert.isNull(status.riskAssessmentError);
      assert.deepStrictEqual(status.errors, []);
    }),
  ),
);

it.effect("returns an empty project status for a workspace with no Gentle AI artifacts", () =>
  withService((service, home) =>
    Effect.gen(function* () {
      const status = yield* service.getProjectStatus({ workspaceRoot: home });

      assert.deepStrictEqual(status.oddTasks, []);
      assert.deepStrictEqual(status.openspecChanges, []);
      assert.isFalse(status.skillRegistry.present);
      assert.isNull(status.skillRegistry.skillCount);
      assert.strictEqual(status.skillRegistry.path, ".atl/skill-registry.md");
      assert.isFalse(status.openspecConfigPresent);
      assert.isFalse(status.engramPresent);
      assert.deepStrictEqual(status.errors, []);
    }),
  ),
);

it.effect("fails CLI-backed calls with the install hint when the binary is missing", () =>
  withService((service) =>
    Effect.gen(function* () {
      const doctor = yield* Effect.flip(service.runDoctor);
      assert.strictEqual(doctor._tag, "GentleAiBinaryNotFoundError");
      assert.isNotEmpty(doctor.message);

      const updates = yield* Effect.flip(service.checkUpdates);
      assert.strictEqual(updates._tag, "GentleAiBinaryNotFoundError");

      const registry = yield* Effect.flip(
        service.refreshSkillRegistry({ workspaceRoot: "E:/repo" }),
      );
      assert.strictEqual(registry._tag, "GentleAiBinaryNotFoundError");

      const reviewMode = yield* Effect.flip(
        service.setReviewMode({ action: "enable", scope: "global" }),
      );
      assert.strictEqual(reviewMode._tag, "GentleAiBinaryNotFoundError");
    }),
  ),
);
