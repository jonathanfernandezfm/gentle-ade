/**
 * Composer banners for Gentle AI readiness: a repository that never ran
 * `sdd-init`, or an environment without the `gentle-ai` binary. The hook owns
 * the two status queries and the per-project dismissal so `ChatView` only
 * splices the items into its banner stack.
 *
 * The project query is gated hard: primary environment only (the binary and
 * `~/.gentle-ai/state.json` belong to a host), binary present, Git checkout.
 * Every project-status read spawns CLI probes on the server, so a thread that
 * cannot show the banner must not start them.
 */
import type { EnvironmentId, GentleAiProjectStatus } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { FlowerIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { GENTLE_ROSE } from "../gentle-ai/primitives";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useGentleAiProjectStatus, useGentleAiStatus } from "../../state/gentleAi";
import { Button } from "../ui/button";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";
import { buildGentleReadinessCopy } from "./gentleFlow.logic";

export const GENTLE_AI_BANNER_DISMISSALS_KEY = "t3code:gentle-ai-banner-dismissals";
const DismissalsSchema = Schema.Array(Schema.String);
const NO_DISMISSALS: ReadonlyArray<string> = [];

export const GENTLE_AI_READINESS_BANNER_ID_PREFIX = "gentle-ai-readiness:";
export const GENTLE_AI_NOT_INSTALLED_BANNER_ID_PREFIX = "gentle-ai-not-installed:";

function installBannerDismissalKey(environmentId: EnvironmentId): string {
  return `binary:${environmentId}`;
}

export interface GentleReadinessBannerInput {
  /** Environment the active thread runs in; banners only apply on the primary one. */
  readonly environmentId: EnvironmentId;
  /** Project checkout root, not the worktree: `sdd-init` state lives in the repository. */
  readonly workspaceRoot: string | null;
  readonly isGitRepo: boolean;
  readonly onStartSddInit: () => void;
  readonly onOpenHub: () => void;
}

export interface GentleReadinessBannerResult {
  readonly items: ReadonlyArray<ComposerBannerStackItem>;
  /** Project status for the active workspace, `null` until it is known or when not applicable. */
  readonly projectStatus: GentleAiProjectStatus | null;
  /** Re-reads the project status, e.g. after a turn that ran `sdd-init`. */
  readonly refreshProjectStatus: () => void;
}

export function useGentleReadinessBanner(
  input: GentleReadinessBannerInput,
): GentleReadinessBannerResult {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const onPrimaryEnvironment =
    primaryEnvironmentId !== null && input.environmentId === primaryEnvironmentId;
  const status = useGentleAiStatus();
  const binaryInstalled = status.data?.binary.installed ?? null;
  const projectQueryRoot =
    onPrimaryEnvironment && binaryInstalled === true && input.isGitRepo
      ? input.workspaceRoot
      : null;
  const project = useGentleAiProjectStatus(projectQueryRoot);
  const [dismissals, setDismissals] = useLocalStorage(
    GENTLE_AI_BANNER_DISMISSALS_KEY,
    NO_DISMISSALS,
    DismissalsSchema,
  );
  const dismiss = useCallback(
    (key: string) => {
      setDismissals((current) => (current.includes(key) ? current : [...current, key]));
    },
    [setDismissals],
  );

  const { workspaceRoot, environmentId, onStartSddInit, onOpenHub, isGitRepo } = input;
  const items = useMemo<ReadonlyArray<ComposerBannerStackItem>>(() => {
    if (!onPrimaryEnvironment || !isGitRepo) return [];
    const openHub = (
      <Button size="xs" variant="ghost" onClick={onOpenHub}>
        Open Gentle AI hub
      </Button>
    );
    if (binaryInstalled === false) {
      const key = installBannerDismissalKey(environmentId);
      if (dismissals.includes(key)) return [];
      return [
        {
          id: `${GENTLE_AI_NOT_INSTALLED_BANNER_ID_PREFIX}${environmentId}`,
          variant: "default",
          priority: "notice",
          icon: <FlowerIcon style={{ color: GENTLE_ROSE }} />,
          title: "Gentle AI isn't installed on this environment",
          description: "Install the gentle-ai binary to use SDD, review, and workflow flows.",
          actions: openHub,
          dismissLabel: "Dismiss Gentle AI install notice",
          onDismiss: () => dismiss(key),
        },
      ];
    }
    if (workspaceRoot === null || project.data === null || dismissals.includes(workspaceRoot)) {
      return [];
    }
    const copy = buildGentleReadinessCopy(project.data);
    if (copy === null) return [];
    return [
      {
        id: `${GENTLE_AI_READINESS_BANNER_ID_PREFIX}${workspaceRoot}`,
        variant: "info",
        priority: "notice",
        icon: <FlowerIcon style={{ color: GENTLE_ROSE }} />,
        title: copy.title,
        description: copy.description,
        actions: (
          <>
            <Button size="xs" variant="default" onClick={onStartSddInit}>
              Set up with SDD init
            </Button>
            {openHub}
          </>
        ),
        dismissLabel: "Dismiss Gentle AI setup notice",
        onDismiss: () => dismiss(workspaceRoot),
      },
    ];
  }, [
    binaryInstalled,
    dismiss,
    dismissals,
    environmentId,
    isGitRepo,
    onOpenHub,
    onPrimaryEnvironment,
    onStartSddInit,
    project.data,
    workspaceRoot,
  ]);

  return {
    items,
    projectStatus: projectQueryRoot === null ? null : project.data,
    refreshProjectStatus: project.refresh,
  };
}
