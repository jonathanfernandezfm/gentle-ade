/**
 * Agents: the 16 surfaces Gentle AI can configure, as a status board.
 *
 * The tiles are deliberately logo-less. Sixteen third-party marks in a grid
 * read as a sponsor wall; an initial monogram plus the config path the CLI
 * writes to is what a user actually needs to recognise a row.
 *
 * @module components/gentle-ai/AgentsSection
 */
import {
  GENTLE_AI_AGENTS,
  type GentleAiAgentId,
  type GentleAiInstallState,
} from "@t3tools/contracts";
import { SettingsIcon } from "lucide-react";

import { cn } from "~/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { GentleSection, GentleTile } from "./primitives";

/** Two-letter monogram, so every tile has a distinct anchor without a logo. */
function monogram(name: string): string {
  const words = name.split(/[\s-]+/).filter((word) => word.length > 0);
  return words.length >= 2
    ? `${words[0]![0]!}${words[1]![0]!}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function AgentTile({
  agentId,
  selected,
  installed,
  onToggle,
  onConfigure,
}: {
  readonly agentId: GentleAiAgentId;
  readonly selected: boolean;
  readonly installed: boolean;
  readonly onToggle?: () => void;
  readonly onConfigure?: () => void;
}) {
  const agent = GENTLE_AI_AGENTS.find((candidate) => candidate.id === agentId)!;
  return (
    <GentleTile
      role={onToggle ? "checkbox" : "button"}
      selected={selected}
      onSelect={onToggle ?? onConfigure}
      ariaLabel={
        onToggle ? `${agent.name}${selected ? ", selected" : ""}` : `Configure ${agent.name}`
      }
      className="gap-2"
    >
      <div className="flex w-full items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-[0.6875rem] font-semibold tracking-tight",
            selected
              ? "border-primary/40 bg-primary/12 text-foreground"
              : "border-border/60 bg-muted/32 text-muted-foreground",
          )}
        >
          {monogram(agent.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[0.8125rem] font-medium text-foreground">
              {agent.name}
            </span>
            {installed ? (
              <Badge size="sm" variant="success">
                installed
              </Badge>
            ) : null}
          </span>
          <span className="block truncate font-mono text-[0.625rem] text-muted-foreground/80">
            {agent.configPath}
          </span>
        </span>
        {onConfigure && !onToggle ? (
          <SettingsIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground" />
        ) : null}
      </div>
      <span className="line-clamp-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
        {agent.description}
      </span>
    </GentleTile>
  );
}

export function AgentsSection({
  state,
  onConfigureAgent,
}: {
  readonly state: GentleAiInstallState | null;
  readonly onConfigureAgent: (agent: GentleAiAgentId) => void;
}) {
  const installed = new Set(state?.installedAgents ?? []);
  return (
    <GentleSection
      id="agents"
      title="Agents"
      description={`Gentle AI writes its skills, persona, and workflow assets into each agent's own configuration directory. ${installed.size} of ${GENTLE_AI_AGENTS.length} are configured on this machine.`}
      action={
        <Button size="xs" variant="outline" onClick={() => onConfigureAgent("claude-code")}>
          Open setup
        </Button>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {GENTLE_AI_AGENTS.map((agent) => (
          <AgentTile
            key={agent.id}
            agentId={agent.id}
            selected={installed.has(agent.id)}
            installed={installed.has(agent.id)}
            onConfigure={() => onConfigureAgent(agent.id)}
          />
        ))}
      </div>
    </GentleSection>
  );
}
