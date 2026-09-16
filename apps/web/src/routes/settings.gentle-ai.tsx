import { createFileRoute } from "@tanstack/react-router";

import { GentleAiSettingsPanel } from "../components/gentle-ai/GentleAiSettingsPanel";

export const Route = createFileRoute("/settings/gentle-ai")({
  component: GentleAiSettingsPanel,
});
