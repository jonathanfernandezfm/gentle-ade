/**
 * Turns "the composer is in Gentle AI flow X" into the text a provider will
 * actually expand.
 *
 * Providers differ in how a workflow is started: Claude and OpenCode expand a
 * leading `/name`, Codex parses `$skill` mentions, and a provider that has
 * neither artifact installed can still be told in prose which workflow to
 * follow. Availability is decided against the provider workspace snapshot the
 * server already reports (`ServerProviderWorkspaceSnapshot.slashCommands` and
 * `.skills`), never assumed from the catalog, so a flow whose command was not
 * installed for that agent degrades to prose instead of sending a bare
 * `/gentle-sdd-new` the provider would treat as literal text.
 *
 * Invocation text always starts with the token: `applyClaudePromptEffortPrefix`
 * refuses to prefix a leading slash command, and inline context envelopes are
 * appended after the body, so the token survives the rest of the send path.
 */
import {
  GENTLE_AI_FLOW_BY_ID,
  type GentleAiFlowDescriptor,
  type GentleAiFlowId,
} from "@t3tools/contracts";

export interface GentleAiFlowInvocationInput {
  readonly flowId: GentleAiFlowId;
  /** Provider driver kind: `claudeAgent`, `codex`, `opencode`, `cursor`, `grok`, `antigravity`, … */
  readonly provider: string;
  /** What the user typed; may be empty for flows whose prompt is optional. */
  readonly text: string;
  /** Slash command names without the leading `/`, from the provider workspace snapshot. */
  readonly availableSlashCommands: ReadonlySet<string>;
  /** Enabled skill names from the provider workspace snapshot. */
  readonly availableSkills: ReadonlySet<string>;
}

export type GentleAiFlowInvocationKind = "none" | "slash-command" | "skill-mention" | "prose";

export interface GentleAiFlowInvocation {
  readonly kind: GentleAiFlowInvocationKind;
  /** The text to send in place of what the user typed. */
  readonly text: string;
  /** The `/name` or `$name` token that opens the text, or `null` for organic and prose. */
  readonly token: string | null;
}

export type GentleAiFlowRoute = Pick<GentleAiFlowInvocation, "kind" | "token">;

type GentleAiProviderFamily = "claude" | "opencode" | "other";

function providerFamily(provider: string): GentleAiProviderFamily {
  switch (provider) {
    case "claude":
    case "claudeAgent":
      return "claude";
    case "opencode":
      return "opencode";
    default:
      return "other";
  }
}

/**
 * Which invocation shape a provider gets for a flow, without composing the
 * text. The picker uses this to label each option ("via /gentle-sdd-new",
 * "via $sdd-explore", or the prose fallback) from the same rules the send
 * path applies.
 */
export function resolveGentleAiFlowRoute(
  input: Omit<GentleAiFlowInvocationInput, "text">,
): GentleAiFlowRoute {
  const flow = GENTLE_AI_FLOW_BY_ID.get(input.flowId);
  if (!flow || flow.id === "organic") {
    return { kind: "none", token: null };
  }
  const family = providerFamily(input.provider);
  const skillAvailable = flow.skill !== null && input.availableSkills.has(flow.skill);
  if (family === "claude") {
    const command = flow.commands.claude;
    if (command !== null && input.availableSlashCommands.has(command)) {
      return { kind: "slash-command", token: `/${command}` };
    }
    if (skillAvailable) {
      return { kind: "slash-command", token: `/${flow.skill}` };
    }
    return { kind: "prose", token: null };
  }
  if (family === "opencode") {
    const command = flow.commands.opencode;
    if (command !== null && input.availableSlashCommands.has(command)) {
      return { kind: "slash-command", token: `/${command}` };
    }
  }
  if (skillAvailable) {
    return { kind: "skill-mention", token: `$${flow.skill}` };
  }
  return { kind: "prose", token: null };
}

function proseLead(flow: GentleAiFlowDescriptor): string {
  if (flow.skill !== null) {
    return `Use the Gentle AI "${flow.skill}" skill for this request: find its SKILL.md in the project or user skills directory, read it first, and follow it exactly.`;
  }
  return `Follow the Gentle AI SDD orchestrator workflow (read the _shared/sdd-orchestrator-workflow.md next to your installed skills first) to ${flow.fallbackIntent}.`;
}

function joinToken(token: string, text: string): string {
  const body = text.trimEnd();
  return body.length === 0 ? token : `${token} ${body}`;
}

function joinProse(lead: string, text: string): string {
  const body = text.trimEnd();
  return body.length === 0 ? lead : `${lead}\n\n${body}`;
}

export function buildGentleAiFlowInvocation(
  input: GentleAiFlowInvocationInput,
): GentleAiFlowInvocation {
  const route = resolveGentleAiFlowRoute(input);
  if (route.kind === "none") {
    return { kind: "none", text: input.text, token: null };
  }
  if (route.token !== null) {
    return { kind: route.kind, text: joinToken(route.token, input.text), token: route.token };
  }
  const flow = GENTLE_AI_FLOW_BY_ID.get(input.flowId)!;
  return { kind: "prose", text: joinProse(proseLead(flow), input.text), token: null };
}
