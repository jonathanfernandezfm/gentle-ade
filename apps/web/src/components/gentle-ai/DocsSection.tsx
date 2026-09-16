/**
 * Documentation links.
 *
 * Links open through the app's shell helper so the desktop build hands them to
 * the OS browser instead of navigating the renderer away from the hub.
 *
 * @module components/gentle-ai/DocsSection
 */
import { ArrowUpRightIcon, BookOpenIcon } from "lucide-react";
import { useCallback } from "react";

import { readLocalApi } from "~/localApi";

import { GentleSection } from "./primitives";

const GENTLE_AI_REPO = "https://github.com/Gentleman-Programming/gentle-ai";

interface DocLink {
  readonly title: string;
  readonly description: string;
  readonly url: string;
}

const DOC_LINKS: ReadonlyArray<DocLink> = [
  {
    title: "Gentle AI README",
    description: "What Gentle AI installs, and how the CLI is organised.",
    url: `${GENTLE_AI_REPO}#readme`,
  },
  {
    title: "Quickstart",
    description: "Install the binary and configure your first agent.",
    url: `${GENTLE_AI_REPO}/blob/main/docs/quickstart.md`,
  },
  {
    title: "Usage: ODD and SDD",
    description: "Organic and Spec-Driven Development, and when each applies.",
    url: `${GENTLE_AI_REPO}/blob/main/docs/usage.md`,
  },
  {
    title: "Engram",
    description: "The persistent-memory MCP server and its save protocol.",
    url: `${GENTLE_AI_REPO}/blob/main/docs/engram.md`,
  },
  {
    title: "Review integration (RDD)",
    description: "The receipt-driven review lifecycle, consent, and authority.",
    url: `${GENTLE_AI_REPO}/blob/main/docs/review-integration.md`,
  },
  {
    title: "Agents matrix",
    description: "Every supported agent and what Gentle AI writes for it.",
    url: `${GENTLE_AI_REPO}/blob/main/docs/agents.md`,
  },
  {
    title: "Gentle ADE hub guide",
    description: "This hub, section by section (docs/user/gentle-ai.md).",
    url: "https://github.com/pingdotgg/t3code/blob/main/docs/user/gentle-ai.md",
  },
];

export function DocsSection() {
  const open = useCallback((url: string) => {
    void readLocalApi()?.shell.openExternal(url);
  }, []);

  return (
    <GentleSection
      id="docs"
      title="Documentation"
      description="Primary sources for everything this hub configures."
    >
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {DOC_LINKS.map((link) => (
          <button
            key={link.url}
            type="button"
            onClick={() => open(link.url)}
            className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 bg-card/30 p-3 text-left outline-none transition-[background-color,border-color] hover:border-border hover:bg-accent/32 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[0.8125rem] font-medium text-foreground">
                  {link.title}
                </span>
                <ArrowUpRightIcon className="size-3 shrink-0 text-muted-foreground/70 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
              </span>
              <span className="block text-[0.6875rem] leading-relaxed text-muted-foreground">
                {link.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </GentleSection>
  );
}
