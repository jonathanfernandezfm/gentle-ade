/**
 * Settings > Gentle AI: the summary and the one switch worth having here.
 *
 * Everything that needs space -- the wizard, the skills catalog, the console --
 * lives in the hub. This panel exists so someone looking through Settings finds
 * Gentle AI where they expect it, and can get to the hub in one click.
 *
 * @module components/gentle-ai/GentleAiSettingsPanel
 */
import { GENTLE_AI_AGENTS } from "@t3tools/contracts";
import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { gentleAiSetReviewModeCommand, useGentleAiStatus } from "~/state/gentleAi";
import { useAtomCommand } from "~/state/use-atom-command";

import { SettingsPageContainer, SettingsRow, SettingsSection } from "../settings/settingsLayout";
import { searchableSetting } from "../settings/settingsSearch";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { GentlePill } from "./primitives";

export function GentleAiSettingsPanel() {
  const navigate = useNavigate();
  const environmentId = usePrimaryEnvironmentId();
  const { data: status, isPending, refresh } = useGentleAiStatus();
  const setReviewMode = useAtomCommand(gentleAiSetReviewModeCommand, { reportFailure: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = status?.state ?? null;

  const toggleRdd = useCallback(
    async (enabled: boolean) => {
      if (environmentId === null) return;
      setPending(true);
      setError(null);
      const result = await setReviewMode({
        environmentId,
        input: { action: enabled ? "enable" : "disable", scope: "global" },
      });
      setPending(false);
      if (result._tag !== "Success") {
        setError("The review mode could not be changed on this machine.");
        return;
      }
      refresh();
    },
    [environmentId, refresh, setReviewMode],
  );

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("gentle-ai")}
        icon={<SparklesIcon className="size-4" />}
      >
        <SettingsRow
          title="Status"
          description={
            status === null
              ? "Connect an environment to read its Gentle AI installation."
              : status.binary.installed
                ? `Gentle AI ${status.binary.version ?? ""} is installed on the primary environment.`
                : "Gentle AI is not installed on the primary environment."
          }
          control={
            isPending && status === null ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : (
              <Badge
                size="control"
                variant={status?.binary.installed === true ? "success" : "warning"}
              >
                {status?.binary.installed === true ? "Installed" : "Not installed"}
              </Badge>
            )
          }
        >
          {status === null ? null : (
            <div className="flex flex-wrap gap-2 pt-2">
              <GentlePill
                tone={status.engram.installed ? "ok" : "muted"}
                label="Engram"
                value={status.engram.installed ? (status.engram.version ?? "installed") : "none"}
              />
              <GentlePill tone="muted" label="Preset" value={state?.preset ?? "none"} />
              <GentlePill tone="muted" label="SDD" value={state?.sddMode ?? "none"} />
            </div>
          )}
        </SettingsRow>

        <SettingsRow
          {...searchableSetting("gentle-ai-rdd")}
          description="Opt-in and off by default. When on, deliverable candidates can be adversarially reviewed, and each candidate still asks for your consent."
          status={
            error === null ? null : (
              <span className="text-xs text-destructive-foreground">{error}</span>
            )
          }
          control={
            <span className="flex items-center gap-2">
              {pending ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
              <Switch
                aria-label="Receipt-driven development"
                checked={state?.rddMode === "on"}
                disabled={pending || status?.binary.installed !== true}
                onCheckedChange={(checked) => void toggleRdd(checked)}
              />
            </span>
          }
        />

        <SettingsRow
          {...searchableSetting("gentle-ai-persona")}
          description="The voice Gentle AI installs into every configured agent. Change it from the hub."
          control={
            <Badge size="control" variant="outline">
              {state?.persona ?? "none"}
            </Badge>
          }
        />

        <SettingsRow
          {...searchableSetting("gentle-ai-agents")}
          description="Agents that currently hold a Gentle AI configuration."
        >
          <div className="flex flex-wrap gap-1.5 pt-2">
            {state === null || state.installedAgents.length === 0 ? (
              <span className="text-[0.8125rem] text-muted-foreground">
                No agents are configured yet.
              </span>
            ) : (
              state.installedAgents.map((agentId) => (
                <Badge key={agentId} size="control" variant="secondary">
                  {GENTLE_AI_AGENTS.find((agent) => agent.id === agentId)?.name ?? agentId}
                </Badge>
              ))
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          title="Gentle AI hub"
          description="Install and reconfigure agents, browse the skills catalog, inspect per-project SDD and review state, and watch the CLI run."
          control={
            <Button size="sm" onClick={() => void navigate({ to: "/gentle-ai" })}>
              <ArrowUpRightIcon />
              Open hub
            </Button>
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
