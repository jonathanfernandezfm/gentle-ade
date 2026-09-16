/**
 * The Gentle AI hub: one page that covers everything the terminal TUI does.
 *
 * Layout is a hero band plus a sticky section nav over a single scroll column.
 * The nav is a real anchor list -- it survives a reload and a deep link -- and
 * the active section is tracked with an IntersectionObserver rather than scroll
 * maths, so it stays correct at any zoom.
 *
 * @module components/gentle-ai/GentleAiHubPage
 */
import type { GentleAiAgentId, GentleAiStatus } from "@t3tools/contracts";
import { CircleAlertIcon, FlowerIcon, PlugZapIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useGentleAiConsole, useGentleAiStatus } from "~/state/gentleAi";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { SidebarInset } from "../ui/sidebar";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { AgentsSection } from "./AgentsSection";
import { DocsSection } from "./DocsSection";
import { FeaturesSection } from "./FeaturesSection";
import { GentleAiConsole } from "./GentleAiConsole";
import { OverviewSection } from "./OverviewSection";
import { PersonaModelsSection } from "./PersonaModelsSection";
import { ProjectSection } from "./ProjectSection";
import { SetupWizard } from "./SetupWizard";
import { SkillsSection } from "./SkillsSection";
import { GENTLE_ROSE, GentlePill } from "./primitives";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "setup", label: "Setup" },
  { id: "agents", label: "Agents" },
  { id: "features", label: "Features" },
  { id: "skills", label: "Skills" },
  { id: "persona", label: "Persona & Models" },
  { id: "project", label: "Project" },
  { id: "console", label: "Console" },
  { id: "docs", label: "Docs" },
] as const;

/** Tracks which section owns the viewport, for the sticky nav's active state. */
function useActiveSection(enabled: boolean): string {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .toSorted((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible !== undefined) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element !== null) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}

function SectionNav({ active, running }: { readonly active: string; readonly running: boolean }) {
  const scrollTo = useCallback((id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <nav
      aria-label="Gentle AI sections"
      className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-1 overflow-x-auto border-b border-border/50 bg-background/88 px-1 py-2 backdrop-blur-md"
    >
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          aria-current={active === section.id ? "true" : undefined}
          onClick={() => scrollTo(section.id)}
          className={cn(
            "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            active === section.id
              ? "bg-primary/12 text-foreground"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          {section.label}
        </button>
      ))}
      {running ? (
        <Badge size="control" variant="info" className="ms-auto shrink-0 gap-1.5">
          <Spinner className="size-3" />
          Running…
        </Badge>
      ) : null}
    </nav>
  );
}

function Hero({ status }: { readonly status: GentleAiStatus }) {
  const { binary, engram, state, statePresent } = status;
  const headline = binary.installed
    ? `Gentle AI is installed · v${binary.version ?? "unknown"}`
    : "Gentle AI is not installed";
  const subline = binary.installed
    ? state === null
      ? statePresent
        ? "The state file exists but could not be read, so the hub cannot show your selection."
        : "No configuration has been written yet. Run the setup wizard to choose what to install."
      : `${state.installedAgents.length} agent${
          state.installedAgents.length === 1 ? "" : "s"
        } configured · ${state.components.length} component${
          state.components.length === 1 ? "" : "s"
        } installed`
    : "Install the CLI to configure agents, skills, personas, and the SDD/RDD workflow from here.";

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/40 px-5 py-6 shadow-xs/5 sm:px-7 sm:py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-16 size-80 rounded-full opacity-45 blur-3xl"
        style={{
          background: `radial-gradient(circle at center, ${GENTLE_ROSE} 0%, transparent 68%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 size-72 rounded-full opacity-24 blur-3xl"
        style={{
          background: `radial-gradient(circle at center, ${GENTLE_ROSE} 0%, transparent 70%)`,
        }}
      />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <FlowerIcon className="size-3.5" style={{ color: GENTLE_ROSE }} />
          Agentic Development Environment
        </p>
        <h1 className="text-balance text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
          {headline}
        </h1>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
          {subline}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <GentlePill
            tone={binary.installed ? "ok" : "fail"}
            label="Binary"
            value={binary.installed ? (binary.version ?? "installed") : "missing"}
          />
          <GentlePill
            tone={engram.installed ? "ok" : "muted"}
            label="Engram"
            value={engram.installed ? (engram.version ?? "installed") : "not installed"}
          />
          <GentlePill
            tone={state?.rddMode === "on" ? "accent" : "muted"}
            label="RDD"
            value={state?.rddMode ?? "unknown"}
          />
          <GentlePill tone="muted" label="Persona" value={state?.persona ?? "none"} />
          <GentlePill tone="muted" label="Preset" value={state?.preset ?? "none"} />
          {state?.pendingSync === true ? (
            <GentlePill tone="warn" label="Sync" value="pending" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HubShell({ children }: { readonly children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <SidebarInset className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <WorkspacePageHeader electron={isElectron}>
        <WorkspaceBreadcrumb ariaLabel="Gentle AI breadcrumb" className="min-w-0 flex-1">
          <WorkspaceBreadcrumbItem current>
            <span className="flex items-center gap-1.5">
              <SparklesIcon className="size-3.5" style={{ color: GENTLE_ROSE }} />
              Gentle AI
            </span>
          </WorkspaceBreadcrumbItem>
        </WorkspaceBreadcrumb>
        <Button
          size="xs"
          variant="ghost-muted"
          onClick={() => void navigate({ to: "/settings/gentle-ai" })}
        >
          <SettingsIcon />
          Settings
        </Button>
      </WorkspacePageHeader>
      <div className="topbar-scroll-fade scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
        <WorkspacePageContainer width="expanded" className="gap-8">
          {children}
        </WorkspacePageContainer>
      </div>
    </SidebarInset>
  );
}

export function GentleAiHubPage() {
  const { data: status, error, isPending, refresh } = useGentleAiStatus();
  const { isRunning } = useGentleAiConsole();
  const active = useActiveSection(status !== null);
  const [preselectedAgent, setPreselectedAgent] = useState<GentleAiAgentId | null>(null);
  // A new preselection has to rebuild the wizard's seed even when the same agent
  // is picked twice, so the key carries a nonce alongside the agent id.
  const wizardNonce = useRef(0);
  const [wizardKey, setWizardKey] = useState("wizard-0");

  const openWizardFor = useCallback((agent: GentleAiAgentId | null) => {
    wizardNonce.current += 1;
    setPreselectedAgent(agent);
    setWizardKey(`wizard-${wizardNonce.current}`);
    document.getElementById("setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const state = useMemo(() => status?.state ?? null, [status]);

  if (error !== null) {
    return (
      <HubShell>
        <Empty className="min-h-64 gap-4">
          <EmptyMedia className="mb-0" variant="icon">
            <CircleAlertIcon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Gentle AI status is unavailable</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </Empty>
      </HubShell>
    );
  }

  if (status === null) {
    return (
      <HubShell>
        {isPending ? (
          <>
            <Skeleton className="h-44 rounded-2xl" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </>
        ) : (
          <Empty className="min-h-64 gap-4">
            <EmptyMedia className="mb-0" variant="icon">
              <PlugZapIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No environment is connected</EmptyTitle>
              <EmptyDescription>
                Gentle AI is installed per machine. Connect an environment to read its binary,
                Engram install, and configuration state.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </HubShell>
    );
  }

  return (
    <HubShell>
      <Hero status={status} />
      <SectionNav active={active} running={isRunning} />
      {status.statePresent && status.state === null ? (
        <p
          role="alert"
          className="rounded-xl border border-warning/28 bg-warning/8 px-4 py-3 text-[0.8125rem] leading-relaxed text-warning-foreground"
        >
          The state file at <code className="font-mono">{status.stateFilePath}</code> exists but
          could not be read. Sections that depend on it show defaults; a fresh install rewrites it.
        </p>
      ) : null}
      <OverviewSection status={status} />
      <SetupWizard
        key={wizardKey}
        state={state}
        preselectedAgent={preselectedAgent}
        onStateChanged={refresh}
      />
      <AgentsSection state={state} onConfigureAgent={openWizardFor} />
      <FeaturesSection status={status} state={state} onStateChanged={refresh} />
      <SkillsSection state={state} onStateChanged={refresh} />
      <PersonaModelsSection
        state={state}
        onOpenWizard={() => openWizardFor(null)}
        onStateChanged={refresh}
      />
      <ProjectSection status={status} />
      <GentleAiConsole />
      <DocsSection />
    </HubShell>
  );
}
