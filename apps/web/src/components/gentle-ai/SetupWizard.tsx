/**
 * The install / reconfigure wizard.
 *
 * All five steps stay reachable: the stepper is a keyboard-navigable tab list,
 * not a one-way funnel, because reconfiguring usually means changing one thing
 * in a step the user already passed. The review step shows the command the
 * server will build -- display only; the server owns argv.
 *
 * @module components/gentle-ai/SetupWizard
 */
import {
  GENTLE_AI_AGENTS,
  GENTLE_AI_COMPONENTS,
  GENTLE_AI_PERSONAS,
  GENTLE_AI_PRESETS,
  type GentleAiAgentId,
  type GentleAiChannel,
  type GentleAiInstallState,
  type GentleAiScope,
  type GentleAiSddMode,
} from "@t3tools/contracts";
import { CheckIcon, PlayIcon, RotateCcwIcon, WandSparklesIcon } from "lucide-react";
import { useCallback, useMemo, useReducer, type KeyboardEvent } from "react";

import { cn } from "~/lib/utils";
import { useGentleAiRunner } from "~/state/gentleAi";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { AgentTile } from "./AgentsSection";
import {
  composeCommandDisplay,
  gentleAiWizardReducer,
  GENTLE_AI_WIZARD_STEPS,
  groupSkills,
  wizardBlockedReason,
  wizardInstallRequest,
  wizardStateFromInstallState,
  type GentleAiWizardStepId,
} from "./gentleAi.logic";
import { GentleCard, GentleField, GentleSection, GentleTile } from "./primitives";

function Stepper({
  step,
  onSelect,
}: {
  readonly step: GentleAiWizardStepId;
  readonly onSelect: (step: GentleAiWizardStepId) => void;
}) {
  const index = GENTLE_AI_WIZARD_STEPS.findIndex((candidate) => candidate.id === step);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      const next = Math.min(Math.max(index + delta, 0), GENTLE_AI_WIZARD_STEPS.length - 1);
      onSelect(GENTLE_AI_WIZARD_STEPS[next]!.id);
    },
    [index, onSelect],
  );

  return (
    <div
      role="tablist"
      aria-label="Setup steps"
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-card/30 p-1.5"
    >
      {GENTLE_AI_WIZARD_STEPS.map((candidate, candidateIndex) => {
        const isActive = candidate.id === step;
        const isDone = candidateIndex < index;
        return (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            id={`gentle-ai-step-tab-${candidate.id}`}
            aria-selected={isActive}
            aria-controls={`gentle-ai-step-panel-${candidate.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(candidate.id)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/12 text-foreground shadow-xs/5"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border text-[0.5625rem]",
                isActive
                  ? "border-primary/56 bg-primary/16 text-foreground"
                  : isDone
                    ? "border-success/40 bg-success/12 text-success-foreground"
                    : "border-border/60 text-muted-foreground",
              )}
            >
              {isDone ? <CheckIcon className="size-2.5" /> : candidateIndex + 1}
            </span>
            {candidate.label}
          </button>
        );
      })}
    </div>
  );
}

function StepPanel({
  step,
  active,
  children,
}: {
  readonly step: GentleAiWizardStepId;
  readonly active: boolean;
  readonly children: React.ReactNode;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`gentle-ai-step-panel-${step}`}
      aria-labelledby={`gentle-ai-step-tab-${step}`}
      tabIndex={0}
      className="mt-4 rounded-xl border border-border/60 bg-card/30 p-4 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </div>
  );
}

function ChoiceRow<A extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly value: A;
  readonly options: ReadonlyArray<{ readonly value: A; readonly label: string }>;
  readonly onChange: (value: A) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-foreground">{label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ToggleGroup
        aria-label={label}
        value={[value]}
        onValueChange={(next) => {
          const selected = next[0];
          if (typeof selected === "string") onChange(selected as A);
        }}
      >
        {options.map((option) => (
          <Toggle key={option.value} value={option.value} aria-label={option.label}>
            {option.label}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function SetupWizard({
  state,
  preselectedAgent,
  onStateChanged,
}: {
  readonly state: GentleAiInstallState | null;
  readonly preselectedAgent: GentleAiAgentId | null;
  readonly onStateChanged: () => void;
}) {
  const seed = useMemo(
    () => wizardStateFromInstallState(state, preselectedAgent ?? undefined),
    [state, preselectedAgent],
  );
  const [wizard, dispatch] = useReducer(gentleAiWizardReducer, seed);
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const installed = new Set(state?.installedAgents ?? []);
  const blockedReason = wizardBlockedReason(wizard);
  const skillGroups = useMemo(() => groupSkills(), []);

  const execute = useCallback(
    async (dryRun: boolean) => {
      await run(wizardInstallRequest(wizard, dryRun));
      onStateChanged();
    },
    [onStateChanged, run, wizard],
  );

  return (
    <GentleSection
      id="setup"
      title={state === null ? "Set up Gentle AI" : "Reconfigure"}
      description="Pick the agents, components, skills, and persona to install. Nothing runs until you press Install."
      action={
        <Button
          size="xs"
          variant="ghost-muted"
          onClick={() => dispatch({ type: "reset", state: seed })}
        >
          <RotateCcwIcon />
          Reset
        </Button>
      }
    >
      <Stepper step={wizard.step} onSelect={(step) => dispatch({ type: "goto", step })} />

      <StepPanel step="agents" active={wizard.step === "agents"}>
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
          Select every agent that should receive the Gentle AI configuration.{" "}
          <span className="text-foreground">{wizard.agents.length} selected.</span>
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {GENTLE_AI_AGENTS.map((agent) => (
            <AgentTile
              key={agent.id}
              agentId={agent.id}
              selected={wizard.agents.includes(agent.id)}
              installed={installed.has(agent.id)}
              onToggle={() => dispatch({ type: "toggleAgent", agent: agent.id })}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              dispatch({ type: "setAgents", agents: GENTLE_AI_AGENTS.map((agent) => agent.id) })
            }
          >
            Select all
          </Button>
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => dispatch({ type: "setAgents", agents: [] })}
          >
            Clear
          </Button>
        </div>
      </StepPanel>

      <StepPanel step="components" active={wizard.step === "components"}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {GENTLE_AI_PRESETS.map((preset) => (
            <GentleTile
              key={preset.id}
              role="radio"
              selected={wizard.preset === preset.id}
              onSelect={() => dispatch({ type: "setPreset", preset: preset.id })}
              ariaLabel={preset.label}
            >
              <span className="text-[0.8125rem] font-medium text-foreground">{preset.label}</span>
              <span className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                {preset.description}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {preset.components.length === 0 ? (
                  <Badge size="sm" variant="secondary">
                    your selection
                  </Badge>
                ) : (
                  preset.components.map((component) => (
                    <Badge key={component} size="sm" variant="outline">
                      {component}
                    </Badge>
                  ))
                )}
              </span>
            </GentleTile>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-border/50 pt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {wizard.preset === "custom"
              ? "Pick the components yourself."
              : "Changing a component switches the preset to Custom."}
          </p>
          {GENTLE_AI_COMPONENTS.map((component) => (
            <Label
              key={component.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/32"
            >
              <Checkbox
                className="mt-0.5"
                checked={wizard.components.includes(component.id)}
                onCheckedChange={() =>
                  dispatch({ type: "toggleComponent", component: component.id })
                }
              />
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-medium text-foreground">
                  {component.name}
                </span>
                <span className="block text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {component.description}
                </span>
              </span>
            </Label>
          ))}
        </div>
      </StepPanel>

      <StepPanel step="skills" active={wizard.step === "skills"}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            Leaving every skill unselected installs the default set. Select skills only to pin an
            explicit list.
          </p>
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => dispatch({ type: "clearSkills" })}
            disabled={wizard.skills.length === 0}
          >
            Use defaults
          </Button>
        </div>
        <div className="space-y-4">
          {skillGroups.map((group) => {
            const ids = group.skills.map((skill) => skill.id);
            const allSelected = ids.every((id) => wizard.skills.includes(id));
            return (
              <div key={group.category}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium tracking-wide text-foreground/80 uppercase">
                    {group.label}
                  </h4>
                  <Button
                    size="micro"
                    variant="ghost-muted"
                    onClick={() =>
                      dispatch({ type: "setSkillGroup", skills: ids, selected: !allSelected })
                    }
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </Button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.skills.map((skill) => (
                    <Label
                      key={skill.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/32"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={wizard.skills.includes(skill.id)}
                        onCheckedChange={() => dispatch({ type: "toggleSkill", skill: skill.id })}
                      />
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] text-foreground">{skill.name}</span>
                        <span className="block text-[0.6875rem] leading-relaxed text-muted-foreground">
                          {skill.description}
                        </span>
                      </span>
                    </Label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </StepPanel>

      <StepPanel step="persona" active={wizard.step === "persona"}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {GENTLE_AI_PERSONAS.map((persona) => (
            <GentleTile
              key={persona.id}
              role="radio"
              selected={wizard.persona === persona.id}
              onSelect={() => dispatch({ type: "setPersona", persona: persona.id })}
              ariaLabel={persona.label}
            >
              <span className="text-[0.8125rem] font-medium text-foreground">{persona.label}</span>
              <span className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                {persona.description}
              </span>
            </GentleTile>
          ))}
        </div>
        <div className="mt-4 divide-y divide-border/50 border-t border-border/50">
          <ChoiceRow<GentleAiSddMode>
            label="SDD mode"
            description="Single-agent runs every phase in one thread; multi-agent delegates each phase."
            value={wizard.sddMode}
            options={[
              { value: "single", label: "Single" },
              { value: "multi", label: "Multi" },
            ]}
            onChange={(sddMode) => dispatch({ type: "setSddMode", sddMode })}
          />
          <ChoiceRow<GentleAiScope>
            label="Scope"
            description="Global installs into your user configuration; workspace stays inside this project."
            value={wizard.scope}
            options={[
              { value: "global", label: "Global" },
              { value: "workspace", label: "Workspace" },
            ]}
            onChange={(scope) => dispatch({ type: "setScope", scope })}
          />
          <ChoiceRow<GentleAiChannel>
            label="Channel"
            description="Beta tracks prerelease assets; stable follows published releases."
            value={wizard.channel}
            options={[
              { value: "stable", label: "Stable" },
              { value: "beta", label: "Beta" },
            ]}
            onChange={(channel) => dispatch({ type: "setChannel", channel })}
          />
        </div>
      </StepPanel>

      <StepPanel step="review" active={wizard.step === "review"}>
        <div className="grid gap-4 lg:grid-cols-2">
          <GentleCard className="bg-card/50">
            <div className="space-y-0.5">
              <GentleField
                label="Agents"
                value={wizard.agents.length === 0 ? "none" : wizard.agents.join(", ")}
              />
              <GentleField label="Preset" value={wizard.preset} />
              <GentleField label="Components" value={wizard.components.join(", ") || "none"} />
              <GentleField
                label="Skills"
                value={
                  wizard.skills.length === 0 ? "default set" : `${wizard.skills.length} pinned`
                }
              />
              <GentleField label="Persona" value={wizard.persona} />
              <GentleField label="SDD mode" value={wizard.sddMode} />
              <GentleField label="Scope" value={wizard.scope} />
              <GentleField label="Channel" value={wizard.channel} />
            </div>
          </GentleCard>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                The command the server will run:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/24 px-2.5 py-2 font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-foreground/85">
                {composeCommandDisplay(wizardInstallRequest(wizard, false))}
              </pre>
            </div>
            {blockedReason !== null ? (
              <p role="status" className="text-[0.8125rem] text-warning-foreground">
                {blockedReason}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void execute(false)}
                disabled={isRunning || !isAvailable || blockedReason !== null}
              >
                {isRunning ? <Spinner /> : <PlayIcon />}
                Install
              </Button>
              <Button
                variant="outline"
                onClick={() => void execute(true)}
                disabled={isRunning || !isAvailable || blockedReason !== null}
              >
                <WandSparklesIcon />
                Dry run
              </Button>
            </div>
          </div>
        </div>
      </StepPanel>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "back" })}
          disabled={wizard.step === "agents"}
        >
          Back
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "next" })}
          disabled={wizard.step === "review"}
        >
          Next
        </Button>
      </div>
    </GentleSection>
  );
}
