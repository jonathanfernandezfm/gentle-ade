/**
 * Per-project state: review mode, SDD status, risk, ODD task docs, the skill
 * registry, and Engram presence for one workspace.
 *
 * Every sub-check is independent on the server, so a failing probe lands in
 * `errors[]` and the rest of the panel still renders. The risk assessment's
 * usual "error" is benign -- a clean tree has nothing to assess -- so it is
 * shown as an explanation, not as a failure.
 *
 * @module components/gentle-ai/ProjectSection
 */
import type { GentleAiProjectStatus, GentleAiRiskTier, GentleAiStatus } from "@t3tools/contracts";
import {
  BrainIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderGitIcon,
  ListChecksIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useProjects } from "~/state/entities";
import { usePrimaryEnvironmentId } from "~/state/environments";
import {
  gentleAiRefreshSkillRegistryCommand,
  useGentleAiProjectStatus,
  useGentleAiRunner,
} from "~/state/gentleAi";
import { useAtomCommand } from "~/state/use-atom-command";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { formatRelativeTime } from "./gentleAi.logic";
import {
  GentleCard,
  GentleCardTitle,
  GentleField,
  GentleProgress,
  GentleSection,
} from "./primitives";

const RISK_VARIANT: Readonly<Record<GentleAiRiskTier, "success" | "warning" | "error">> = {
  passive: "success",
  medium: "warning",
  high: "error",
};

function ReviewModeCard({
  project,
  workspaceRoot,
  onChanged,
}: {
  readonly project: GentleAiProjectStatus;
  readonly workspaceRoot: string;
  readonly onChanged: () => void;
}) {
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const reviewMode = project.reviewMode;

  const setCloneDisabled = useCallback(
    async (disabled: boolean) => {
      await run({
        kind: "review-mode",
        options: {
          action: disabled ? "disable" : "enable",
          scope: "clone",
          cwd: workspaceRoot,
        },
      });
      onChanged();
    },
    [onChanged, run, workspaceRoot],
  );

  return (
    <GentleCard>
      <GentleCardTitle
        icon={<ReceiptTextIcon className="size-4 text-muted-foreground" />}
        action={
          reviewMode === null ? null : (
            <Badge size="control" variant={reviewMode.effective === "on" ? "success" : "secondary"}>
              {reviewMode.effective}
            </Badge>
          )
        }
      >
        Review mode (RDD)
      </GentleCardTitle>
      {reviewMode === null ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          The CLI could not report the review mode for this checkout.
        </p>
      ) : (
        <>
          <div className="space-y-0.5">
            <GentleField label="Global" value={reviewMode.global} />
            <GentleField
              label="Clone override"
              value={reviewMode.cloneLocal.length === 0 ? "none" : reviewMode.cloneLocal}
            />
            <GentleField label="Decided by" value={reviewMode.source} />
          </div>
          <div className="mt-3 flex items-start justify-between gap-4 border-t border-border/50 pt-3">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium text-foreground">Disable for this clone</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                A clone-local off overrides the global mode for this checkout only.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isRunning ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
              <Switch
                aria-label="Disable receipt-driven development for this clone"
                checked={reviewMode.cloneLocal === "off"}
                disabled={isRunning || !isAvailable}
                onCheckedChange={(checked) => void setCloneDisabled(checked)}
              />
            </div>
          </div>
        </>
      )}
    </GentleCard>
  );
}

function SddCard({ project }: { readonly project: GentleAiProjectStatus }) {
  const sdd = project.sddStatus;
  return (
    <GentleCard>
      <GentleCardTitle
        icon={<ListChecksIcon className="size-4 text-muted-foreground" />}
        action={
          sdd?.changeName == null ? null : (
            <Badge size="control" variant="outline">
              {sdd.changeName}
            </Badge>
          )
        }
      >
        SDD status
      </GentleCardTitle>
      {sdd === null ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          No active SDD change in this workspace.
        </p>
      ) : (
        <>
          <div className="space-y-0.5">
            <GentleField label="Artifact store" value={sdd.artifactStore} />
            <GentleField label="Planning home" value={sdd.planningHomePath} mono />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(sdd.artifacts).map(([artifact, artifactState]) => (
              <Badge
                key={artifact}
                size="sm"
                variant={artifactState === "present" ? "success" : "secondary"}
              >
                {artifact}
              </Badge>
            ))}
          </div>
          <div className="mt-3 border-t border-border/50 pt-3">
            <GentleProgress
              label="Tasks complete"
              completed={sdd.taskProgress.completed}
              total={sdd.taskProgress.total}
            />
          </div>
        </>
      )}
    </GentleCard>
  );
}

function RiskCard({ project }: { readonly project: GentleAiProjectStatus }) {
  const risk = project.riskAssessment;
  return (
    <GentleCard>
      <GentleCardTitle
        icon={<ShieldAlertIcon className="size-4 text-muted-foreground" />}
        action={
          risk === null ? null : (
            <Badge size="control" variant={RISK_VARIANT[risk.risk]}>
              {risk.risk}
            </Badge>
          )
        }
      >
        Candidate risk
      </GentleCardTitle>
      {risk === null ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {project.riskAssessmentError ?? "No risk assessment is available for this workspace."}
        </p>
      ) : (
        <>
          <div className="space-y-0.5">
            <GentleField label="Changed paths" value={risk.changedPaths} />
            <GentleField label="Changed lines" value={risk.changedLines} />
          </div>
          {risk.reasons.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-border/50 pt-3">
              {risk.reasons.map((reason, index) => (
                <li
                  key={`${reason.code}-${index}`}
                  className="text-[0.75rem] leading-relaxed text-muted-foreground"
                >
                  <span className="font-mono text-foreground/85">{reason.code}</span>
                  {reason.path === undefined ? null : (
                    <span className="font-mono"> · {reason.path}</span>
                  )}
                  {reason.detail === undefined ? null : <span> — {reason.detail}</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </GentleCard>
  );
}

function WorkspaceAssetsCard({
  project,
  workspaceRoot,
  onChanged,
}: {
  readonly project: GentleAiProjectStatus;
  readonly workspaceRoot: string;
  readonly onChanged: () => void;
}) {
  const environmentId = usePrimaryEnvironmentId();
  const refreshRegistry = useAtomCommand(gentleAiRefreshSkillRegistryCommand, {
    reportFailure: false,
  });
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    if (environmentId === null) return;
    setPending(true);
    await refreshRegistry({ environmentId, input: { workspaceRoot } });
    setPending(false);
    onChanged();
  }, [environmentId, onChanged, refreshRegistry, workspaceRoot]);

  return (
    <GentleCard>
      <GentleCardTitle
        icon={<FileTextIcon className="size-4 text-muted-foreground" />}
        action={
          <Button size="xs" variant="outline" onClick={() => void refresh()} disabled={pending}>
            {pending ? <Spinner /> : <RefreshCwIcon />}
            Refresh
          </Button>
        }
      >
        Workspace assets
      </GentleCardTitle>
      <div className="space-y-0.5">
        <GentleField
          label="Skill registry"
          value={
            project.skillRegistry.present
              ? `${project.skillRegistry.skillCount ?? "?"} skills${
                  formatRelativeTime(project.skillRegistry.updatedAt) === null
                    ? ""
                    : ` · ${formatRelativeTime(project.skillRegistry.updatedAt)}`
                }`
              : "missing"
          }
        />
        <GentleField label="Registry path" value={project.skillRegistry.path} mono />
        <GentleField
          label="Engram folder"
          value={project.engramPresent ? "present" : "not found"}
        />
        <GentleField label="Git repository" value={project.isGitRepo ? "yes" : "no"} />
        <GentleField
          label="OpenSpec changes"
          value={project.openspecChanges.length === 0 ? "none" : project.openspecChanges.join(", ")}
        />
      </div>
    </GentleCard>
  );
}

function OddTasksCard({ project }: { readonly project: GentleAiProjectStatus }) {
  return (
    <GentleCard>
      <GentleCardTitle icon={<BrainIcon className="size-4 text-muted-foreground" />}>
        ODD task documents
      </GentleCardTitle>
      {project.oddTasks.length === 0 ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          No <code className="font-mono">odd/tasks/*.md</code> documents in this workspace.
        </p>
      ) : (
        <ul className="space-y-3">
          {project.oddTasks.map((task) => (
            <li key={task.path}>
              <GentleProgress label={task.name} completed={task.completed} total={task.total} />
              <p className="mt-1 truncate font-mono text-[0.625rem] text-muted-foreground/70">
                {task.path}
              </p>
            </li>
          ))}
        </ul>
      )}
    </GentleCard>
  );
}

export function ProjectSection({ status }: { readonly status: GentleAiStatus }) {
  const environmentId = usePrimaryEnvironmentId();
  const projects = useProjects();
  const candidates = useMemo(
    () =>
      projects.filter(
        (project) => environmentId === null || project.environmentId === environmentId,
      ),
    [environmentId, projects],
  );
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const workspaceRoot = selectedRoot ?? candidates[0]?.workspaceRoot ?? null;
  const { data: project, error, isPending, refresh } = useGentleAiProjectStatus(workspaceRoot);

  if (!status.binary.installed) {
    return (
      <GentleSection
        id="project"
        title="Project"
        description="Per-project review mode, SDD status, and workspace assets."
      >
        <p className="rounded-xl border border-border/60 bg-card/30 px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
          Install the gentle-ai binary to inspect per-project state.
        </p>
      </GentleSection>
    );
  }

  return (
    <GentleSection
      id="project"
      title="Project"
      description="Review mode, SDD status, candidate risk, and workspace assets for one checkout."
      action={
        candidates.length === 0 ? null : (
          <>
            <Select
              value={workspaceRoot ?? ""}
              onValueChange={(next) => setSelectedRoot(String(next))}
            >
              <SelectTrigger size="sm" aria-label="Project" className="min-w-48">
                <FolderGitIcon className="size-3.5" />
                <SelectValue>
                  {candidates.find((candidate) => candidate.workspaceRoot === workspaceRoot)
                    ?.title ?? "Select a project"}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.workspaceRoot} value={candidate.workspaceRoot}>
                    {candidate.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button size="xs" variant="outline" onClick={refresh} disabled={isPending}>
              {isPending ? <Spinner /> : <RefreshCwIcon />}
              Refresh
            </Button>
          </>
        )
      }
    >
      {workspaceRoot === null ? (
        <p className="rounded-xl border border-border/60 bg-card/30 px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
          Add a project to this environment to inspect its Gentle AI state.
        </p>
      ) : error !== null ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/28 bg-destructive/8 px-4 py-3 text-[0.8125rem] text-destructive-foreground"
        >
          {error}
        </p>
      ) : project === null ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <p className="mb-3 truncate font-mono text-[0.6875rem] text-muted-foreground/80">
            {project.workspaceRoot}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReviewModeCard project={project} workspaceRoot={workspaceRoot} onChanged={refresh} />
            <SddCard project={project} />
            <RiskCard project={project} />
            <WorkspaceAssetsCard
              project={project}
              workspaceRoot={workspaceRoot}
              onChanged={refresh}
            />
            <OddTasksCard project={project} />
          </div>
          {project.errors.length > 0 ? (
            <Collapsible className="mt-4">
              <CollapsibleTrigger
                render={
                  <Button size="xs" variant="ghost-muted">
                    <ChevronDownIcon />
                    {project.errors.length} sub-check{project.errors.length === 1 ? "" : "s"} failed
                  </Button>
                }
              />
              <CollapsiblePanel>
                <ul className="mt-2 space-y-1 rounded-lg border border-border/50 bg-muted/16 p-2.5">
                  {project.errors.map((message, index) => (
                    <li
                      key={`${index}-${message}`}
                      className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground"
                    >
                      {message}
                    </li>
                  ))}
                </ul>
              </CollapsiblePanel>
            </Collapsible>
          ) : null}
        </>
      )}
    </GentleSection>
  );
}
