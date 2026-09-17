import { describe, expect, it } from "vite-plus/test";
import type { RuntimeSubagent } from "@t3tools/client-runtime/state/subagentRuntime";
import {
  deriveAgentSpawnSummary,
  gentleAgentRoleGroup,
  isGentleAgentRole,
} from "./agentSpawnSummary";

const batch = (status: RuntimeSubagent["status"]) => ({ kind: "subagent_batch" as const, status });
const agent = (status: RuntimeSubagent["status"], role: string | null = null) => ({
  kind: "subagent" as const,
  status,
  role,
});

describe("deriveAgentSpawnSummary", () => {
  it("counts a native batch without claiming the number of children", () => {
    expect(deriveAgentSpawnSummary({ agents: [batch("running")], agentCount: 1 })).toEqual({
      live: true,
      lead: "Launched 1 subagent batch",
      status: "1 working",
      tone: "working",
      gentle: 0,
    });
    expect(deriveAgentSpawnSummary({ agents: [batch("idle")], agentCount: 1 })).toEqual({
      live: false,
      lead: "Launched 1 subagent batch",
      status: "1 idle",
      tone: "inactive",
      gentle: 0,
    });
  });

  it("counts Gentle AI roles so the spawn row can tag them", () => {
    expect(
      deriveAgentSpawnSummary({
        agents: [
          agent("completed", "sdd-apply"),
          agent("completed", "jd-judge-a"),
          agent("completed", "review-risk"),
          agent("completed", "Explore"),
        ],
        agentCount: 4,
      }),
    ).toMatchObject({ lead: "Ran 4 subagents", gentle: 3 });
  });

  it("keeps individual agents and batches separate in a mixed group", () => {
    expect(
      deriveAgentSpawnSummary({
        agents: [agent("running"), batch("running"), batch("idle")],
        agentCount: 3,
      }).lead,
    ).toBe("Launched 1 subagent and 2 batches");
  });

  it.each([
    ["idle", "1 idle", "inactive"],
    ["cancelled", "1 stopped", "inactive"],
    ["interrupted", "1 stopped", "inactive"],
    ["failed", "1 failed", "failed"],
    ["completed", "✓ completed", "completed"],
  ] as const)("reports %s accurately alongside a completed agent", (state, status, tone) => {
    expect(
      deriveAgentSpawnSummary({ agents: [agent("completed"), agent(state)], agentCount: 2 }),
    ).toMatchObject({ live: false, status, tone });
  });

  it("does not claim completion when the roster is missing a member", () => {
    expect(deriveAgentSpawnSummary({ agents: [agent("completed")], agentCount: 2 })).toMatchObject({
      status: "Status unavailable",
      tone: "inactive",
    });
  });

  it("keeps a workflow active between child launches", () => {
    expect(
      deriveAgentSpawnSummary({
        agents: [agent("completed")],
        agentCount: 1,
        coordinatorStatus: "running",
      }),
    ).toMatchObject({ live: true, status: "working", tone: "working" });
  });

  it.each([
    ["failed", "Workflow failed", "failed"],
    ["cancelled", "Workflow stopped", "inactive"],
  ] as const)(
    "preserves a %s workflow outcome when its children completed",
    (coordinatorStatus, status, tone) => {
      expect(
        deriveAgentSpawnSummary({ agents: [agent("completed")], agentCount: 1, coordinatorStatus }),
      ).toMatchObject({ live: false, status, tone });
    },
  );
});

describe("gentleAgentRoleGroup", () => {
  it.each([
    ["sdd-apply", "sdd"],
    ["SDD-Verify", "sdd"],
    ["jd-judge-a", "review"],
    ["review-readability", "review"],
    [" review-risk ", "review"],
  ] as const)("maps %s to the %s accent", (role, group) => {
    expect(gentleAgentRoleGroup(role)).toBe(group);
    expect(isGentleAgentRole(role)).toBe(true);
  });

  it.each(["Explore", "general-purpose", "reviewer", "sddx", "", null, undefined])(
    "leaves %s untagged",
    (role) => {
      expect(gentleAgentRoleGroup(role)).toBeNull();
      expect(isGentleAgentRole(role)).toBe(false);
    },
  );
});
