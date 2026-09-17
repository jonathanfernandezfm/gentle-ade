import {
  GENTLE_AI_FLOW_BY_ID,
  type GentleAiFlowGroup,
  type GentleAiFlowId,
  type OrchestrationLatestTurn,
  type TurnId,
} from "@t3tools/contracts";
import type { TimelineEntry } from "../../session-logic";

export type GentleFlowOutcome = "completed" | "interrupted" | "error";

/** Divider rendered immediately above the user message that entered a Gentle AI flow. */
export interface GentleFlowStartMark {
  readonly kind: "gentle-flow-start";
  readonly id: string;
  readonly createdAt: string;
  /** Turn the message kicked off, once the timeline has an entry for it. */
  readonly turnId: TurnId | null;
  readonly flowId: GentleAiFlowId;
  readonly group: GentleAiFlowGroup;
  readonly label: string;
}

/** Divider rendered after the last row of a settled flow turn. */
export interface GentleFlowEndMark {
  readonly kind: "gentle-flow-end";
  readonly id: string;
  readonly createdAt: string;
  readonly turnId: TurnId;
  readonly flowId: GentleAiFlowId;
  readonly group: GentleAiFlowGroup;
  readonly label: string;
  readonly durationMs: number | null;
  readonly outcome: GentleFlowOutcome;
}

export interface GentleFlowEndPlacement {
  readonly mark: GentleFlowEndMark;
  /**
   * Every provider turn the flow message produced (a promptless restart adds a
   * second one). The mark follows the last visible row of any of them.
   */
  readonly turnIds: ReadonlySet<TurnId>;
}

export interface GentleFlowMarks {
  /** Keyed by the flow-tagged user message id. */
  readonly startByMessageId: ReadonlyMap<string, GentleFlowStartMark>;
  readonly ends: ReadonlyArray<GentleFlowEndPlacement>;
}

const EMPTY_MARKS: GentleFlowMarks = { startByMessageId: new Map(), ends: [] };

type LatestTurn = Pick<OrchestrationLatestTurn, "turnId" | "state" | "startedAt" | "completedAt">;

interface PendingFlow {
  messageId: string;
  createdAt: string;
  flowId: GentleAiFlowId;
  group: GentleAiFlowGroup;
  label: string;
  turnIds: TurnId[];
  lastEntryEnd: string | null;
}

function elapsedMs(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function laterIso(a: string | null, b: string): string {
  if (a === null) return b;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (!Number.isFinite(aMs)) return b;
  if (!Number.isFinite(bMs)) return a;
  return bMs > aMs ? b : a;
}

function entryTurnId(entry: TimelineEntry): TurnId | null {
  switch (entry.kind) {
    case "message":
      return entry.message.role === "user" ? null : (entry.message.turnId ?? null);
    case "proposed-plan":
      return entry.proposedPlan.turnId;
    case "work":
      return entry.entry.turnId ?? null;
  }
}

function entryEnd(entry: TimelineEntry): string {
  return entry.kind === "message" ? entry.message.updatedAt : entry.createdAt;
}

/**
 * Start and end dividers for user messages sent from a Gentle AI flow
 * (`message.context.gentleAiFlow`). A flow spans the turns between that
 * message and the next user message. The end mark exists only once every one
 * of those turns has settled; its duration runs from the send to the last
 * entry (or the latest turn's own timing when it is the flow's turn), and its
 * outcome mirrors the latest turn's state, else `completed`. Organic carries
 * no marks: it is the untagged default.
 */
export function deriveGentleFlowMarks(input: {
  timelineEntries: ReadonlyArray<TimelineEntry>;
  latestTurn: LatestTurn | null;
  unsettledTurnId: TurnId | null;
}): GentleFlowMarks {
  const startByMessageId = new Map<string, GentleFlowStartMark>();
  const ends: GentleFlowEndPlacement[] = [];
  let pending: PendingFlow | null = null;

  const closePending = () => {
    if (!pending) return;
    const flow = pending;
    pending = null;
    startByMessageId.set(flow.messageId, {
      kind: "gentle-flow-start",
      id: `gentle-flow-start:${flow.messageId}`,
      createdAt: flow.createdAt,
      turnId: flow.turnIds[0] ?? null,
      flowId: flow.flowId,
      group: flow.group,
      label: flow.label,
    });
    const firstTurnId = flow.turnIds[0];
    if (firstTurnId === undefined) return;
    if (input.unsettledTurnId !== null && flow.turnIds.includes(input.unsettledTurnId)) return;

    const latestTurn = input.latestTurn;
    const ownsLatestTurn = latestTurn !== null && flow.turnIds.includes(latestTurn.turnId);
    const durationMs =
      ownsLatestTurn && latestTurn.startedAt && latestTurn.completedAt
        ? elapsedMs(latestTurn.startedAt, latestTurn.completedAt)
        : flow.lastEntryEnd !== null
          ? elapsedMs(flow.createdAt, flow.lastEntryEnd)
          : null;
    const outcome: GentleFlowOutcome =
      ownsLatestTurn && latestTurn.state === "interrupted"
        ? "interrupted"
        : ownsLatestTurn && latestTurn.state === "error"
          ? "error"
          : "completed";
    ends.push({
      mark: {
        kind: "gentle-flow-end",
        id: `gentle-flow-end:${flow.messageId}`,
        createdAt: flow.lastEntryEnd ?? flow.createdAt,
        turnId: firstTurnId,
        flowId: flow.flowId,
        group: flow.group,
        label: flow.label,
        durationMs,
        outcome,
      },
      turnIds: new Set(flow.turnIds),
    });
  };

  for (const entry of input.timelineEntries) {
    if (entry.kind === "message" && entry.message.role === "user") {
      closePending();
      const flowId = entry.message.context?.gentleAiFlow;
      const descriptor = flowId === undefined ? undefined : GENTLE_AI_FLOW_BY_ID.get(flowId);
      if (!descriptor || descriptor.group === "organic") continue;
      pending = {
        messageId: entry.message.id,
        createdAt: entry.message.createdAt,
        flowId: descriptor.id,
        group: descriptor.group,
        label: descriptor.label,
        turnIds: entry.message.turnId ? [entry.message.turnId] : [],
        lastEntryEnd: null,
      };
      continue;
    }
    if (!pending) continue;
    const turnId = entryTurnId(entry);
    if (turnId === null) continue;
    if (!pending.turnIds.includes(turnId)) pending.turnIds.push(turnId);
    pending.lastEntryEnd = laterIso(pending.lastEntryEnd, entryEnd(entry));
  }
  closePending();

  return startByMessageId.size === 0 ? EMPTY_MARKS : { startByMessageId, ends };
}
