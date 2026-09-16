import { createFileRoute } from "@tanstack/react-router";

import { GentleAiHubPage } from "../components/gentle-ai/GentleAiHubPage";

export const Route = createFileRoute("/gentle-ai")({
  component: GentleAiHubPage,
});
