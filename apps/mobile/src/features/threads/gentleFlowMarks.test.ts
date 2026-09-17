import { describe, expect, it } from "vite-plus/test";

import { MessageId, TurnId, type GentleAiFlowId } from "@t3tools/contracts";

import type { ThreadFeedEntry, ThreadFeedLatestTurn } from "../../lib/threadActivity";
import { insertGentleFlowMarks } from "./gentleFlowMarks";

function userMessage(options: {
  readonly id: string;
  readonly createdAt: string;
  readonly flow?: GentleAiFlowId;
}): ThreadFeedEntry {
  return {
    type: "message",
    id: options.id,
    createdAt: options.createdAt,
    message: {
      id: MessageId.make(options.id),
      role: "user",
      text: "auth refactor",
      turnId: null,
      streaming: false,
      createdAt: options.createdAt,
      updatedAt: options.createdAt,
      ...(options.flow ? { context: { version: 1, gentleAiFlow: options.flow, records: [] } } : {}),
    },
  } as const;
}

function assistantMessage(options: {
  readonly id: string;
  readonly turnId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}): ThreadFeedEntry {
  return {
    type: "message",
    id: options.id,
    createdAt: options.createdAt,
    message: {
      id: MessageId.make(options.id),
      role: "assistant",
      text: "Done.",
      turnId: TurnId.make(options.turnId),
      streaming: false,
      createdAt: options.createdAt,
      updatedAt: options.updatedAt,
    },
  } as const;
}

function workGroup(options: {
  readonly id: string;
  readonly turnId: string;
  readonly createdAt: string;
}): ThreadFeedEntry {
  return {
    type: "activity-group",
    id: options.id,
    createdAt: options.createdAt,
    turnId: TurnId.make(options.turnId),
    activities: [],
  } as const;
}

function latestTurn(options: {
  readonly turnId: string;
  readonly state: ThreadFeedLatestTurn["state"];
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}): ThreadFeedLatestTurn {
  return {
    turnId: TurnId.make(options.turnId),
    state: options.state,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
  };
}

const labels = (rows: ReadonlyArray<{ readonly type: string }>) =>
  rows.map((row) => (row.type.startsWith("gentle-flow") ? row : { type: row.type }));

describe("gentle flow marks", () => {
  it("brackets a flow-tagged message with its turn's work", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z", flow: "sdd-new" }),
      workGroup({ id: "group-1", turnId: "turn-1", createdAt: "2026-04-01T00:00:03.000Z" }),
      assistantMessage({
        id: "assistant-1",
        turnId: "turn-1",
        createdAt: "2026-04-01T00:04:00.000Z",
        updatedAt: "2026-04-01T00:04:12.000Z",
      }),
    ];

    const marked = insertGentleFlowMarks(
      rows,
      latestTurn({
        turnId: "turn-1",
        state: "completed",
        startedAt: "2026-04-01T00:00:00.000Z",
        completedAt: "2026-04-01T00:04:12.000Z",
      }),
    );

    expect(labels(marked)).toEqual([
      {
        type: "gentle-flow-start",
        id: "gentle-flow-start:user-1",
        createdAt: "2026-04-01T00:00:00.000Z",
        turnId: null,
        flowId: "sdd-new",
        group: "sdd",
        label: "SDD · New change started",
      },
      { type: "message" },
      { type: "activity-group" },
      { type: "message" },
      {
        type: "gentle-flow-end",
        id: "gentle-flow-end:user-1",
        createdAt: "2026-04-01T00:04:12.000Z",
        turnId: "turn-1",
        flowId: "sdd-new",
        group: "sdd",
        label: "SDD · New change finished · 4m 12s",
      },
    ]);
  });

  it("withholds the finish mark while the flow's turn is still running", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z", flow: "judgment-day" }),
      workGroup({ id: "group-1", turnId: "turn-1", createdAt: "2026-04-01T00:00:03.000Z" }),
    ];

    const marked = insertGentleFlowMarks(
      rows,
      latestTurn({
        turnId: "turn-1",
        state: "running",
        startedAt: "2026-04-01T00:00:00.000Z",
        completedAt: null,
      }),
    );

    expect(marked.map((row) => row.type)).toEqual([
      "gentle-flow-start",
      "message",
      "activity-group",
    ]);
  });

  it("withholds both marks' turn while the message is still only queued", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z", flow: "sdd-apply" }),
    ];

    const marked = insertGentleFlowMarks(rows, null);

    expect(marked.map((row) => row.type)).toEqual(["gentle-flow-start", "message"]);
  });

  it("reports how the flow's turn ended", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z", flow: "sdd-verify" }),
      assistantMessage({
        id: "assistant-1",
        turnId: "turn-1",
        createdAt: "2026-04-01T00:00:03.000Z",
        updatedAt: "2026-04-01T00:00:30.000Z",
      }),
    ];
    const endLabel = (state: ThreadFeedLatestTurn["state"]) =>
      insertGentleFlowMarks(
        rows,
        latestTurn({
          turnId: "turn-1",
          state,
          startedAt: "2026-04-01T00:00:00.000Z",
          completedAt: "2026-04-01T00:00:30.000Z",
        }),
      ).at(-1);

    expect(endLabel("interrupted")).toMatchObject({
      type: "gentle-flow-end",
      label: "SDD · Verify stopped · 30s",
    });
    expect(endLabel("error")).toMatchObject({
      type: "gentle-flow-end",
      label: "SDD · Verify failed · 30s",
    });
  });

  it("measures an older flow from its own rows, not the latest turn", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z", flow: "sdd-ff" }),
      assistantMessage({
        id: "assistant-1",
        turnId: "turn-1",
        createdAt: "2026-04-01T00:00:03.000Z",
        updatedAt: "2026-04-01T00:01:05.000Z",
      }),
      userMessage({ id: "user-2", createdAt: "2026-04-01T00:02:00.000Z" }),
      assistantMessage({
        id: "assistant-2",
        turnId: "turn-2",
        createdAt: "2026-04-01T00:02:01.000Z",
        updatedAt: "2026-04-01T00:09:00.000Z",
      }),
    ];

    const marked = insertGentleFlowMarks(
      rows,
      latestTurn({
        turnId: "turn-2",
        state: "running",
        startedAt: "2026-04-01T00:02:00.000Z",
        completedAt: null,
      }),
    );

    expect(marked.map((row) => row.type)).toEqual([
      "gentle-flow-start",
      "message",
      "message",
      "gentle-flow-end",
      "message",
      "message",
    ]);
    expect(marked[3]).toMatchObject({
      label: "SDD · Fast-forward planning finished · 1m 5s",
    });
  });

  it("leaves an untagged or organic thread untouched", () => {
    const rows = [
      userMessage({ id: "user-1", createdAt: "2026-04-01T00:00:00.000Z" }),
      userMessage({ id: "user-2", createdAt: "2026-04-01T00:01:00.000Z", flow: "organic" }),
      assistantMessage({
        id: "assistant-1",
        turnId: "turn-1",
        createdAt: "2026-04-01T00:01:03.000Z",
        updatedAt: "2026-04-01T00:01:09.000Z",
      }),
    ];

    expect(
      insertGentleFlowMarks(
        rows,
        latestTurn({
          turnId: "turn-1",
          state: "completed",
          startedAt: "2026-04-01T00:01:00.000Z",
          completedAt: "2026-04-01T00:01:09.000Z",
        }),
      ),
    ).toBe(rows);
  });
});
