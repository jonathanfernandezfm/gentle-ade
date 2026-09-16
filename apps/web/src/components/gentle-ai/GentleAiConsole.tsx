/**
 * The hub's command console.
 *
 * Every command the hub runs streams here, so the user sees the same output the
 * terminal would have shown. A non-zero exit is a footer, not an error banner:
 * `gentle-ai doctor` exits non-zero on a legitimately unhealthy machine.
 *
 * @module components/gentle-ai/GentleAiConsole
 */
import { CheckIcon, CopyIcon, EraserIcon, TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";
import { useGentleAiConsole } from "~/state/gentleAi";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import {
  formatConsoleText,
  formatDuration,
  GENTLE_AI_COMMAND_LABELS,
  type GentleAiConsoleState,
} from "./gentleAi.logic";
import { GentleSection } from "./primitives";

function ConsoleFooter({ state }: { readonly state: GentleAiConsoleState }) {
  if (state.error !== null) {
    return (
      <p className="border-t border-border/50 px-3 py-2 text-xs text-destructive-foreground">
        {state.error}
      </p>
    );
  }
  if (state.exitCode === null) return null;
  return (
    <p
      className={cn(
        "border-t border-border/50 px-3 py-2 font-mono text-[0.6875rem]",
        state.exitCode === 0 ? "text-success-foreground" : "text-destructive-foreground",
      )}
    >
      exit {state.exitCode}
      {state.durationMs === null ? "" : ` · ${formatDuration(state.durationMs)}`}
    </p>
  );
}

export function GentleAiConsole() {
  const { state, isRunning, clear } = useGentleAiConsole();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Follow the tail only while the user is already at the bottom, so reading
  // back through a long install is not yanked away by the next line.
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 120) {
      element.scrollTop = element.scrollHeight;
    }
  }, [state.lines, state.exitCode]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(formatConsoleText(state)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [state]);

  const label = state.kind === null ? null : GENTLE_AI_COMMAND_LABELS[state.kind];

  return (
    <GentleSection
      id="console"
      title="Console"
      description="Live output from the gentle-ai CLI. One command runs at a time."
      action={
        <>
          <Button
            size="xs"
            variant="outline"
            onClick={clear}
            disabled={isRunning || state.lines.length === 0}
          >
            <EraserIcon />
            Clear
          </Button>
          <Button size="xs" variant="outline" onClick={copy} disabled={state.lines.length === 0}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border/60 bg-[color-mix(in_oklab,var(--color-card)_70%,black_12%)] shadow-xs/5">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-foreground/80">
            {state.command ?? (label === null ? "No command has run yet." : `${label}…`)}
          </code>
          {isRunning ? (
            <Badge size="sm" variant="info" className="gap-1">
              <Spinner className="size-2.5" />
              Running
            </Badge>
          ) : state.status === "succeeded" ? (
            <Badge size="sm" variant="success">
              Done
            </Badge>
          ) : state.status === "failed" ? (
            <Badge size="sm" variant="error">
              Failed
            </Badge>
          ) : null}
        </div>
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Gentle AI command output"
          className="scrollbar-gutter-both h-72 overflow-y-auto px-3 py-2 font-mono text-[0.6875rem] leading-[1.5]"
        >
          {state.droppedLines > 0 ? (
            <p className="pb-1 text-muted-foreground/70">
              … {state.droppedLines} earlier lines were dropped
            </p>
          ) : null}
          {state.lines.length === 0 ? (
            <p className="text-muted-foreground/70">
              {isRunning ? "Waiting for output…" : "Run a command to see its output here."}
            </p>
          ) : (
            state.lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  line.stream === "stderr" ? "text-warning-foreground" : "text-foreground/85",
                )}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
        <ConsoleFooter state={state} />
      </div>
    </GentleSection>
  );
}
