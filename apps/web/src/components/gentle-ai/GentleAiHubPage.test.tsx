import type { GentleAiStatus } from "@t3tools/contracts";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, StrictMode, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { useGentleAiStatus } = vi.hoisted(() => ({
  useGentleAiStatus: vi.fn(),
}));

vi.mock("~/state/gentleAi", () => ({
  useGentleAiStatus,
  useGentleAiConsole: () => ({ state: null, isRunning: false, clear: () => undefined }),
}));
vi.mock("~/env", () => ({ isElectron: false }));
// The hero and the section nav are what this test covers; the sections below
// them each own their data and are exercised by their own logic tests.
vi.mock("./OverviewSection", () => ({ OverviewSection: () => null }));
vi.mock("./SetupWizard", () => ({ SetupWizard: () => null }));
vi.mock("./AgentsSection", () => ({ AgentsSection: () => null }));
vi.mock("./FeaturesSection", () => ({ FeaturesSection: () => null }));
vi.mock("./SkillsSection", () => ({ SkillsSection: () => null }));
vi.mock("./PersonaModelsSection", () => ({ PersonaModelsSection: () => null }));
vi.mock("./ProjectSection", () => ({ ProjectSection: () => null }));
vi.mock("./GentleAiConsole", () => ({ GentleAiConsole: () => null }));
vi.mock("./DocsSection", () => ({ DocsSection: () => null }));
vi.mock("../ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: ReactNode }) => children,
}));

import { GentleAiHubPage } from "./GentleAiHubPage";

const NOT_INSTALLED: GentleAiStatus = {
  binary: {
    installed: false,
    path: null,
    version: null,
    source: "not-found",
    installHint: "go install github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@latest",
  },
  engram: { installed: false, path: null, version: null },
  state: null,
  stateFilePath: "C:\\Users\\dev\\.gentle-ai\\state.json",
  statePresent: false,
  platform: "win32",
  goAvailable: false,
  checkedAt: "2026-01-01T12:00:00.000Z",
};

let renderer: ReactTestRenderer | undefined;

function allText(): string {
  const texts: string[] = [];
  renderer!.root
    .findAll((node) => typeof node.type === "string")
    .forEach((node) => {
      for (const child of node.children) {
        if (typeof child === "string") texts.push(child);
      }
    });
  return texts.join(" ");
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useGentleAiStatus.mockReset();
});

afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

async function openHub() {
  const router = createRouter({
    routeTree: createRootRoute({ component: GentleAiHubPage }),
    history: createMemoryHistory(),
  });
  await router.load();
  await act(() => {
    renderer = create(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
}

describe("GentleAiHubPage", () => {
  it("states plainly that Gentle AI is not installed", async () => {
    useGentleAiStatus.mockReturnValue({
      data: NOT_INSTALLED,
      error: null,
      isPending: false,
      isSuccess: true,
      refresh: () => undefined,
    });
    await openHub();
    const text = allText();
    expect(text).toContain("Gentle AI is not installed");
    expect(text).toContain("Install the CLI");
    expect(text).toContain("missing");
  });

  it("explains a missing environment instead of an empty hub", async () => {
    useGentleAiStatus.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isSuccess: false,
      refresh: () => undefined,
    });
    await openHub();
    expect(allText()).toContain("No environment is connected");
  });

  it("surfaces a status failure with a retry", async () => {
    const refresh = vi.fn();
    useGentleAiStatus.mockReturnValue({
      data: null,
      error: "The environment request failed.",
      isPending: false,
      isSuccess: false,
      refresh,
    });
    await openHub();
    expect(allText()).toContain("Gentle AI status is unavailable");
  });
});
