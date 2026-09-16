/**
 * Features: which components are installed, plus the switches that change how
 * the installed workflow behaves.
 *
 * Receipt-driven development is deliberately presented as opt-in with per-
 * candidate consent, because the switch here only sets the global mode: the
 * review itself still asks before it runs.
 *
 * @module components/gentle-ai/FeaturesSection
 */
import {
  GENTLE_AI_COMPONENTS,
  type GentleAiInstallState,
  type GentleAiStatus,
} from "@t3tools/contracts";
import { RefreshCwIcon, ReceiptTextIcon, Trash2Icon, FlaskConicalIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { gentleAiSetReviewModeCommand, useGentleAiRunner } from "~/state/gentleAi";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { GentleCard, GentleCardTitle, GentleSection } from "./primitives";

function FeatureToggleRow({
  icon,
  title,
  description,
  checked,
  disabled,
  pending,
  onCheckedChange,
  ariaLabel,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly ariaLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 gap-2.5">
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pending ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
        <Switch
          aria-label={ariaLabel}
          checked={checked}
          disabled={disabled || pending}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}

export function FeaturesSection({
  status,
  state,
  onStateChanged,
}: {
  readonly status: GentleAiStatus;
  readonly state: GentleAiInstallState | null;
  readonly onStateChanged: () => void;
}) {
  const environmentId = usePrimaryEnvironmentId();
  const setReviewMode = useAtomCommand(gentleAiSetReviewModeCommand, { reportFailure: false });
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const [rddPending, setRddPending] = useState(false);
  const [rddError, setRddError] = useState<string | null>(null);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const installedComponents = new Set(state?.components ?? []);
  const canRun = isAvailable && status.binary.installed && !isRunning;

  const toggleRdd = useCallback(
    async (enabled: boolean) => {
      if (environmentId === null) return;
      setRddPending(true);
      setRddError(null);
      const result = await setReviewMode({
        environmentId,
        input: { action: enabled ? "enable" : "disable", scope: "global" },
      });
      setRddPending(false);
      if (result._tag !== "Success") {
        setRddError("The review mode could not be changed on this machine.");
        return;
      }
      // A global toggle answers with `null` (the CLI only reports state for a
      // clone), so the authoritative value comes from a status refetch.
      onStateChanged();
    },
    [environmentId, onStateChanged, setReviewMode],
  );

  const toggleStrictTdd = useCallback(
    async (enabled: boolean) => {
      await run({ kind: "sync", options: { strictTdd: enabled, dryRun: false } });
      onStateChanged();
    },
    [onStateChanged, run],
  );

  return (
    <GentleSection
      id="features"
      title="Features"
      description="The components Gentle AI installs, and the behaviour switches that apply to them."
      action={
        <>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void run({ kind: "sync", options: { dryRun: false } })}
            disabled={!canRun}
          >
            <RefreshCwIcon />
            Sync
          </Button>
          <Button
            size="xs"
            variant="destructive-outline"
            onClick={() => setUninstallOpen(true)}
            disabled={!canRun}
          >
            <Trash2Icon />
            Uninstall
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <GentleCard>
          <GentleCardTitle>Components</GentleCardTitle>
          <ul className="divide-y divide-border/50">
            {GENTLE_AI_COMPONENTS.map((component) => {
              const installed = installedComponents.has(component.id);
              return (
                <li key={component.id} className="flex items-start gap-2.5 py-2">
                  <span
                    aria-hidden
                    className={
                      installed
                        ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
                        : "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[0.8125rem] font-medium text-foreground">
                        {component.name}
                      </span>
                      {installed ? null : (
                        <Badge size="sm" variant="secondary">
                          not installed
                        </Badge>
                      )}
                    </span>
                    <span className="block text-[0.6875rem] leading-relaxed text-muted-foreground">
                      {component.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </GentleCard>

        <GentleCard>
          <GentleCardTitle>Behaviour</GentleCardTitle>
          <div className="divide-y divide-border/50">
            <FeatureToggleRow
              icon={<ReceiptTextIcon className="size-4" />}
              title="Receipt-Driven Development (RDD)"
              description="Opt-in and off by default. When on, a deliverable candidate can be adversarially reviewed — and every candidate still asks for your consent before a review runs."
              checked={state?.rddMode === "on"}
              disabled={!status.binary.installed}
              pending={rddPending}
              ariaLabel="Receipt-driven development"
              onCheckedChange={(checked) => void toggleRdd(checked)}
            />
            <FeatureToggleRow
              icon={<FlaskConicalIcon className="size-4" />}
              title="Strict TDD"
              description="Requires the SDD agents to observe a failing test before writing the implementation. Applies to the SDD phases, not to ordinary edits."
              checked={state?.strictTdd === true}
              disabled={!canRun}
              pending={isRunning}
              ariaLabel="Strict TDD"
              onCheckedChange={(checked) => void toggleStrictTdd(checked)}
            />
          </div>
          {rddError !== null ? (
            <p role="alert" className="mt-2 text-xs text-destructive-foreground">
              {rddError}
            </p>
          ) : null}
          {state?.pendingSync === true ? (
            <p className="mt-3 rounded-lg border border-warning/28 bg-warning/8 px-2.5 py-2 text-xs text-warning-foreground">
              A sync is pending: the installed assets are older than the current selection.
            </p>
          ) : null}
        </GentleCard>
      </div>

      <AlertDialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Gentle AI from every agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This runs <code className="font-mono text-xs">gentle-ai uninstall --all</code>, which
              removes the managed skills, persona, and workflow assets from every configured agent.
              Your own files stay untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              disabled={!canRun}
              onClick={() => {
                setUninstallOpen(false);
                void run({ kind: "uninstall", options: { all: true } }).then(onStateChanged);
              }}
            >
              Uninstall everything
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </GentleSection>
  );
}
