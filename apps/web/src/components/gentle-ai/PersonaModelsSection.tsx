/**
 * Persona and model assignments.
 *
 * Changing the persona is an `install` with the rest of the current selection
 * unchanged, because the CLI has no persona-only verb. Without a readable state
 * file there is nothing to preserve, so the section sends the user to the
 * wizard instead of guessing a selection.
 *
 * @module components/gentle-ai/PersonaModelsSection
 */
import {
  GENTLE_AI_PERSONAS,
  type GentleAiInstallState,
  type GentleAiPersonaId,
} from "@t3tools/contracts";
import { CpuIcon, UserRoundIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { useGentleAiRunner } from "~/state/gentleAi";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { inferPreset, listPhaseAssignments, type GentleAiModelTier } from "./gentleAi.logic";
import { GentleCard, GentleCardTitle, GentleSection, GentleTile } from "./primitives";

const TIER_VARIANT: Readonly<
  Record<GentleAiModelTier, "info" | "success" | "secondary" | "outline">
> = {
  opus: "info",
  sonnet: "success",
  haiku: "secondary",
  other: "outline",
};

export function PersonaModelsSection({
  state,
  onOpenWizard,
  onStateChanged,
}: {
  readonly state: GentleAiInstallState | null;
  readonly onOpenWizard: () => void;
  readonly onStateChanged: () => void;
}) {
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const assignments = useMemo(
    () => listPhaseAssignments(state?.claudePhaseAssignments ?? {}),
    [state?.claudePhaseAssignments],
  );

  const selectPersona = useCallback(
    async (persona: GentleAiPersonaId) => {
      if (state === null) {
        onOpenWizard();
        return;
      }
      await run({
        kind: "install",
        options: {
          agents: state.installedAgents,
          components: state.components,
          skills: state.skills,
          persona,
          preset: state.preset ?? inferPreset(state.components),
          sddMode: state.sddMode ?? "single",
          scope: "global",
          channel: "stable",
          dryRun: false,
        },
      });
      onStateChanged();
    },
    [onOpenWizard, onStateChanged, run, state],
  );

  return (
    <GentleSection
      id="persona"
      title="Persona & models"
      description="The voice Gentle AI installs, and which model each delegated phase runs on."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <GentleCard>
          <GentleCardTitle
            icon={<UserRoundIcon className="size-4 text-muted-foreground" />}
            action={
              state?.persona == null ? null : (
                <Badge size="control" variant="outline">
                  {state.persona}
                </Badge>
              )
            }
          >
            Persona
          </GentleCardTitle>
          {state === null ? (
            <div className="space-y-3">
              <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                No readable install state, so there is no selection to preserve. Run the setup
                wizard to choose a persona along with the rest of the configuration.
              </p>
              <Button size="sm" variant="outline" onClick={onOpenWizard}>
                Open setup
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                {GENTLE_AI_PERSONAS.map((persona) => (
                  <GentleTile
                    key={persona.id}
                    role="radio"
                    selected={state.persona === persona.id}
                    disabled={isRunning || !isAvailable}
                    onSelect={() => void selectPersona(persona.id)}
                    ariaLabel={persona.label}
                  >
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {persona.label}
                    </span>
                    <span className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                      {persona.description}
                    </span>
                  </GentleTile>
                ))}
              </div>
              <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted-foreground/80">
                Switching persona re-runs the installer with the current agents, components, and
                skills unchanged.
              </p>
            </>
          )}
        </GentleCard>

        <GentleCard>
          <GentleCardTitle icon={<CpuIcon className="size-4 text-muted-foreground" />}>
            Model assignments
          </GentleCardTitle>
          {assignments.length === 0 ? (
            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              No phase assignments are recorded yet. Gentle AI writes them when the SDD component is
              installed for Claude Code.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phase</TableHead>
                  <TableHead className="text-right">Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.phase}>
                    <TableCell className="font-mono text-[0.6875rem]">{assignment.phase}</TableCell>
                    <TableCell className="text-right">
                      <Badge size="sm" variant={TIER_VARIANT[assignment.tier]}>
                        {assignment.model}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted-foreground/80">
            Read-only here. Assignments are edited through the gentle-ai TUI (
            <code className="font-mono">gentle-ai</code> → Model assignments).
          </p>
        </GentleCard>
      </div>
    </GentleSection>
  );
}
