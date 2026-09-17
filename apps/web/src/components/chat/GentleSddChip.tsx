import type { GentleAiSddStatus } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
import { memo } from "react";

import { GENTLE_ROSE } from "../gentle-ai/primitives";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * Thread-header pill for the active SDD change: "SDD · <change> · 3/8 tasks".
 * Purely presentational; `ChatView` decides whether a status applies to the
 * thread. Links to the hub's Project section, which owns the full artifact view.
 */
export const GentleSddChip = memo(function GentleSddChip({
  sddStatus,
}: {
  readonly sddStatus: GentleAiSddStatus | null;
}) {
  if (sddStatus === null || sddStatus.changeName === null) return null;
  const { changeName, taskProgress, artifacts } = sddStatus;
  const tasks =
    taskProgress.total > 0 ? `${taskProgress.completed}/${taskProgress.total} tasks` : null;
  const artifactEntries = Object.entries(artifacts);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to="/gentle-ai"
            hash="project"
            aria-label={`Active SDD change ${changeName}${tasks ? `, ${tasks}` : ""}. Open in the Gentle AI hub.`}
            data-gentle-sdd-chip="true"
            className="inline-flex h-6 max-w-[200px] shrink items-center gap-1 rounded-full border border-border/70 bg-card/50 px-2 text-[0.6875rem] leading-none text-muted-foreground no-underline hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--contrast-foreground)]"
          />
        }
      >
        <ListChecksIcon aria-hidden className="size-3 shrink-0" style={{ color: GENTLE_ROSE }} />
        <span className="shrink-0 font-medium">SDD</span>
        <span aria-hidden className="shrink-0 opacity-60">
          ·
        </span>
        <span className="min-w-0 truncate">{changeName}</span>
        {tasks ? (
          <>
            <span aria-hidden className="shrink-0 opacity-60">
              ·
            </span>
            <span className="shrink-0 tabular-nums">{tasks}</span>
          </>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="bottom" className="max-w-72">
        <div className="grid gap-1">
          <span className="font-medium">{changeName}</span>
          {artifactEntries.length === 0 ? (
            <span className="text-muted-foreground">No artifacts reported.</span>
          ) : (
            <ul className="grid gap-0.5 text-muted-foreground">
              {artifactEntries.map(([artifact, state]) => (
                <li key={artifact} className="flex justify-between gap-3">
                  <span>{artifact}</span>
                  <span className="tabular-nums">{state}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
});
