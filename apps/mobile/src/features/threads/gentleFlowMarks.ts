import {
  GENTLE_AI_FLOW_BY_ID,
  type GentleAiFlowDescriptor,
  type GentleAiFlowGroup,
  type GentleAiFlowId,
  type TurnId,
} from "@t3tools/contracts";
import { formatDuration } from "@t3tools/shared/orchestrationTiming";

import { deriveUnsettledTurnId, type ThreadFeedLatestTurn } from "../../lib/threadActivity";

/**
 * Where a Gentle AI flow started and finished in the timeline. A user message
 * sent from the composer's flow picker carries `context.gentleAiFlow`; the
 * start mark sits above it and the finish mark after the last row of the turn
 * it opened, once that turn has settled. Placement lives here, away from the
 * renderer, so the rules stay testable; the rows render with the same
 * two-hairline anatomy as the context-compaction divider.
 */
interface GentleFlowMark {
  readonly id: string;
  readonly createdAt: string;
  readonly turnId: TurnId | null;
  readonly flowId: GentleAiFlowId;
  readonly group: GentleAiFlowGroup;
  readonly label: string;
}

/** Split per `type` so the feed's row union narrows on the discriminant like every other row. */
export interface GentleFlowStartMark extends GentleFlowMark {
  readonly type: "gentle-flow-start";
}

export interface GentleFlowEndMark extends GentleFlowMark {
  readonly type: "gentle-flow-end";
}

export type GentleFlowMarkEntry = GentleFlowStartMark | GentleFlowEndMark;

/** Accent dot per flow family. `null` keeps the row's subtle icon tint. */
export const GENTLE_FLOW_GROUP_ACCENT: Record<GentleAiFlowGroup, string | null> = {
  organic: null,
  sdd: "#F095C8",
  review: "#F5B94A",
  workflow: "#5ED4C3",
};

/**
 * The part of a feed row these marks read: the flow tag on a user message, and
 * the turn ids and timestamps that say where a flow's turn ends and whether it
 * is still running. Structural so `ThreadFeedEntry` and the outbox rows
 * appended after it both satisfy it without this module knowing either shape.
 */
export interface GentleFlowMarkSourceRow {
  readonly type: string;
  readonly id: string;
  readonly createdAt: string;
  readonly turnId?: TurnId | null;
  readonly message?: {
    readonly id: string;
    readonly role: string;
    readonly turnId: TurnId | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly context?: { readonly gentleAiFlow?: GentleAiFlowId } | undefined;
  };
}

interface GentleFlowSpan {
  readonly descriptor: GentleAiFlowDescriptor;
  readonly messageId: string;
  readonly startedAt: string;
  readonly startIndex: number;
  /** Last row of the flow's turn: the row before the next user message, else the feed's last row. */
  endIndex: number;
}

/**
 * Returns the rows with the flow marks woven in, or the same array when the
 * thread has none — callers memoize this alongside the rest of the feed.
 */
export function insertGentleFlowMarks<Row extends GentleFlowMarkSourceRow>(
  rows: ReadonlyArray<Row>,
  latestTurn: ThreadFeedLatestTurn | null,
): ReadonlyArray<Row | GentleFlowMarkEntry> {
  const spans = collectFlowSpans(rows);
  if (spans.length === 0) {
    return rows;
  }

  const unsettledTurnId = deriveUnsettledTurnId(latestTurn);
  const startMarks = new Map<number, GentleFlowMarkEntry>();
  const endMarks = new Map<number, GentleFlowMarkEntry>();

  for (const span of spans) {
    const { descriptor } = span;
    startMarks.set(span.startIndex, {
      type: "gentle-flow-start",
      id: `gentle-flow-start:${span.messageId}`,
      createdAt: span.startedAt,
      turnId: null,
      flowId: descriptor.id,
      group: descriptor.group,
      label: `${descriptor.label} started`,
    });

    // A flow whose turn produced nothing yet has nothing to close: the message
    // is still on its way out, or the provider has not answered.
    if (span.endIndex <= span.startIndex) {
      continue;
    }
    const spanTurnId = resolveSpanTurnId(rows, span);
    const settled =
      spanTurnId === null
        ? unsettledTurnId === null || span.endIndex < rows.length - 1
        : spanTurnId !== unsettledTurnId;
    if (!settled) {
      continue;
    }

    // Only the latest turn reports its own state and timing; older flows are
    // measured from the message that opened them to the last row they left.
    const matchedTurn =
      spanTurnId !== null && latestTurn?.turnId === spanTurnId ? latestTurn : null;
    const endedAt = rowEndTimestamp(rows[span.endIndex]!);
    const elapsedMs =
      matchedTurn?.startedAt != null && matchedTurn.completedAt != null
        ? elapsedBetween(matchedTurn.startedAt, matchedTurn.completedAt)
        : elapsedBetween(span.startedAt, endedAt);
    const duration = elapsedMs === null ? null : formatDuration(elapsedMs);
    const outcome =
      matchedTurn?.state === "interrupted"
        ? "stopped"
        : matchedTurn?.state === "error"
          ? "failed"
          : "finished";

    endMarks.set(span.endIndex, {
      type: "gentle-flow-end",
      id: `gentle-flow-end:${span.messageId}`,
      createdAt: endedAt,
      turnId: spanTurnId,
      flowId: descriptor.id,
      group: descriptor.group,
      label: duration
        ? `${descriptor.label} ${outcome} · ${duration}`
        : `${descriptor.label} ${outcome}`,
    });
  }

  const result: Array<Row | GentleFlowMarkEntry> = [];
  for (const [index, row] of rows.entries()) {
    const startMark = startMarks.get(index);
    if (startMark) {
      result.push(startMark);
    }
    result.push(row);
    const endMark = endMarks.get(index);
    if (endMark) {
      result.push(endMark);
    }
  }
  return result;
}

function collectFlowSpans(
  rows: ReadonlyArray<GentleFlowMarkSourceRow>,
): ReadonlyArray<GentleFlowSpan> {
  const spans: GentleFlowSpan[] = [];
  let open: GentleFlowSpan | null = null;
  for (const [index, row] of rows.entries()) {
    const message = userMessageOf(row);
    if (!message) {
      continue;
    }
    // The next thing the user says ends the previous flow's turn, whether or
    // not it opens one of its own.
    if (open) {
      open.endIndex = index - 1;
      spans.push(open);
      open = null;
    }
    const descriptor = flowDescriptorOf(message);
    if (!descriptor) {
      continue;
    }
    open = {
      descriptor,
      messageId: message.id,
      startedAt: message.createdAt,
      startIndex: index,
      endIndex: index,
    };
  }
  if (open) {
    open.endIndex = rows.length - 1;
    spans.push(open);
  }
  return spans;
}

function userMessageOf(
  row: GentleFlowMarkSourceRow,
): NonNullable<GentleFlowMarkSourceRow["message"]> | null {
  const message = row.message;
  return row.type === "message" && message !== undefined && message.role === "user"
    ? message
    : null;
}

/** Organic is the composer's default, not a process worth bracketing. */
function flowDescriptorOf(
  message: NonNullable<GentleFlowMarkSourceRow["message"]>,
): GentleAiFlowDescriptor | null {
  const flowId = message.context?.gentleAiFlow;
  if (flowId === undefined) {
    return null;
  }
  const descriptor = GENTLE_AI_FLOW_BY_ID.get(flowId);
  return descriptor === undefined || descriptor.group === "organic" ? null : descriptor;
}

/** The turn the flow message opened, as reported by the first row that names one. */
function resolveSpanTurnId(
  rows: ReadonlyArray<GentleFlowMarkSourceRow>,
  span: GentleFlowSpan,
): TurnId | null {
  for (let index = span.startIndex + 1; index <= span.endIndex; index += 1) {
    const row = rows[index]!;
    const turnId = row.message?.turnId ?? row.turnId ?? null;
    if (turnId !== null) {
      return turnId;
    }
  }
  return null;
}

function rowEndTimestamp(row: GentleFlowMarkSourceRow): string {
  return row.message?.updatedAt ?? row.createdAt;
}

function elapsedBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return Math.max(0, end - start);
}
