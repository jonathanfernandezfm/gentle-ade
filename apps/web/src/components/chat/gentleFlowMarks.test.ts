import { describe, expect, it } from "vite-plus/test";
import { MessageId, TurnId, type GentleAiFlowId } from "@t3tools/contracts";
import { deriveGentleFlowMarks } from "./gentleFlowMarks";
import { deriveTimelineEntries, type WorkLogEntry } from "../../session-logic";
import type { ChatMessage } from "../../types";

const time = (second: number) => new Date(Date.UTC(2026, 8, 4, 0, 0, second)).toISOString();

function userMessage(
  id: string,
  second: number,
  flow?: GentleAiFlowId,
  turnId: TurnId | null = null,
): ChatMessage {
  return {
    id: MessageId.make(id),
    role: "user",
    text: "auth refactor",
    turnId,
    createdAt: time(second),
    updatedAt: time(second),
    streaming: false,
    ...(flow ? { context: { version: 1, records: [], gentleAiFlow: flow } } : {}),
  };
}

function assistantMessage(id: string, turnId: TurnId, second: number, endSecond = second) {
  return {
    id: MessageId.make(id),
    role: "assistant",
    text: "Done.",
    turnId,
    createdAt: time(second),
    updatedAt: time(endSecond),
    streaming: false,
  } satisfies ChatMessage;
}

function work(id: string, turnId: TurnId, second: number): WorkLogEntry {
  return {
    id,
    turnId,
    createdAt: time(second),
    label: "Read file",
    tone: "tool",
    toolCallId: id,
    toolLifecycleStatus: "completed",
    sourceActivityKind: "tool.completed",
  };
}

const turnA = TurnId.make("turn-a");
const turnB = TurnId.make("turn-b");

describe("deriveGentleFlowMarks", () => {
  it("returns no marks for untagged or organic messages", () => {
    const entries = deriveTimelineEntries(
      [userMessage("plain", 0), userMessage("organic", 1, "organic")],
      [],
      [],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: null,
      unsettledTurnId: null,
    });
    expect(marks.startByMessageId.size).toBe(0);
    expect(marks.ends).toEqual([]);
  });

  it("places a start mark on the tagged message and an end mark once its turn settles", () => {
    const entries = deriveTimelineEntries(
      [userMessage("u1", 0, "sdd-new"), assistantMessage("a1", turnA, 10, 12)],
      [],
      [work("w1", turnA, 2)],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: null,
      unsettledTurnId: null,
    });
    expect(marks.startByMessageId.get("u1")).toEqual({
      kind: "gentle-flow-start",
      id: "gentle-flow-start:u1",
      createdAt: time(0),
      turnId: turnA,
      flowId: "sdd-new",
      group: "sdd",
      label: "SDD · New change",
    });
    expect(marks.ends).toEqual([
      {
        mark: {
          kind: "gentle-flow-end",
          id: "gentle-flow-end:u1",
          createdAt: time(12),
          turnId: turnA,
          flowId: "sdd-new",
          group: "sdd",
          label: "SDD · New change",
          durationMs: 12_000,
          outcome: "completed",
        },
        turnIds: new Set([turnA]),
      },
    ]);
  });

  it("withholds the end mark while the flow's turn is unsettled", () => {
    const entries = deriveTimelineEntries(
      [userMessage("u1", 0, "judgment-day")],
      [],
      [work("w1", turnA, 2)],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnA, state: "running", startedAt: time(1), completedAt: null },
      unsettledTurnId: turnA,
    });
    expect(marks.startByMessageId.get("u1")).toMatchObject({ turnId: turnA, group: "review" });
    expect(marks.ends).toEqual([]);
  });

  it("keeps the start mark without an end while the turn has no entries yet", () => {
    const entries = deriveTimelineEntries([userMessage("u1", 0, "sdd-apply")], [], []);
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: null,
      unsettledTurnId: null,
    });
    expect(marks.startByMessageId.get("u1")).toMatchObject({ turnId: null });
    expect(marks.ends).toEqual([]);
  });

  it("uses the latest turn's own timing and state when it is the flow's turn", () => {
    const entries = deriveTimelineEntries(
      [userMessage("u1", 0, "chained-pr"), assistantMessage("a1", turnA, 5)],
      [],
      [],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnA, state: "interrupted", startedAt: time(1), completedAt: time(9) },
      unsettledTurnId: null,
    });
    expect(marks.ends[0]?.mark).toMatchObject({
      group: "workflow",
      durationMs: 8_000,
      outcome: "interrupted",
    });
  });

  it("reports an errored latest turn as failed", () => {
    const entries = deriveTimelineEntries(
      [userMessage("u1", 0, "sdd-verify"), assistantMessage("a1", turnA, 5)],
      [],
      [],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnA, state: "error", startedAt: time(1), completedAt: time(3) },
      unsettledTurnId: null,
    });
    expect(marks.ends[0]?.mark).toMatchObject({ durationMs: 2_000, outcome: "error" });
  });

  it("scopes each flow to the turns before the next user message", () => {
    const entries = deriveTimelineEntries(
      [
        userMessage("u1", 0, "sdd-explore"),
        assistantMessage("a1", turnA, 4),
        userMessage("u2", 5),
        assistantMessage("a2", turnB, 8),
      ],
      [],
      [work("w1", turnA, 2), work("w2", turnB, 6)],
    );
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnB, state: "completed", startedAt: time(5), completedAt: time(9) },
      unsettledTurnId: null,
    });
    expect([...marks.startByMessageId.keys()]).toEqual(["u1"]);
    expect(marks.ends).toHaveLength(1);
    expect(marks.ends[0]).toMatchObject({
      mark: { turnId: turnA, durationMs: 4_000, outcome: "completed" },
      turnIds: new Set([turnA]),
    });
  });

  it("spans a promptless restart and waits for the replacement turn to settle", () => {
    const entries = deriveTimelineEntries(
      [
        userMessage("u1", 0, "sdd-ff"),
        assistantMessage("a1", turnA, 3),
        assistantMessage("a2", turnB, 7),
      ],
      [],
      [],
    );
    const running = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnB, state: "running", startedAt: time(4), completedAt: null },
      unsettledTurnId: turnB,
    });
    expect(running.ends).toEqual([]);

    const settled = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnB, state: "completed", startedAt: time(4), completedAt: time(8) },
      unsettledTurnId: null,
    });
    expect(settled.ends[0]).toMatchObject({
      mark: { turnId: turnA, durationMs: 4_000, outcome: "completed" },
      turnIds: new Set([turnA, turnB]),
    });
  });

  it("trusts the user message's own turn id when the server stamped one", () => {
    const entries = deriveTimelineEntries([userMessage("u1", 0, "sdd-new", turnA)], [], []);
    const marks = deriveGentleFlowMarks({
      timelineEntries: entries,
      latestTurn: { turnId: turnA, state: "completed", startedAt: time(0), completedAt: time(6) },
      unsettledTurnId: null,
    });
    expect(marks.startByMessageId.get("u1")).toMatchObject({ turnId: turnA });
    expect(marks.ends[0]?.mark).toMatchObject({ turnId: turnA, durationMs: 6_000 });
  });
});
