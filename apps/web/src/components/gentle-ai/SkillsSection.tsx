/**
 * Skills: the catalog, what the machine has, and a way to pin an explicit set.
 *
 * An empty `state.skills` is the CLI's way of saying "all defaults", so the
 * section says so rather than rendering 25 "not installed" cards.
 *
 * @module components/gentle-ai/SkillsSection
 */
import {
  GENTLE_AI_SKILLS,
  type GentleAiInstallState,
  type GentleAiSkillCategory,
  type GentleAiSkillId,
} from "@t3tools/contracts";
import { SearchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "~/lib/utils";
import { useGentleAiRunner } from "~/state/gentleAi";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import {
  filterSkills,
  GENTLE_AI_SKILL_CATEGORY_LABELS,
  isSkillInstalled,
  sortSkills,
} from "./gentleAi.logic";
import { GentleSection } from "./primitives";

type CategoryFilter = GentleAiSkillCategory | "all";

const CATEGORY_FILTERS: ReadonlyArray<{ readonly value: CategoryFilter; readonly label: string }> =
  [
    { value: "all", label: "All" },
    { value: "sdd", label: "SDD" },
    { value: "testing", label: "Testing" },
    { value: "workflow", label: "Workflow" },
  ];

export function SkillsSection({
  state,
  onStateChanged,
}: {
  readonly state: GentleAiInstallState | null;
  readonly onStateChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<ReadonlyArray<GentleAiSkillId>>(
    () => state?.skills ?? [],
  );
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const visible = useMemo(() => filterSkills(query, category), [category, query]);
  const installed = state?.skills ?? [];
  const usesDefaults = installed.length === 0;

  const toggle = useCallback((skill: GentleAiSkillId) => {
    setSelected((current) =>
      current.includes(skill)
        ? current.filter((candidate) => candidate !== skill)
        : sortSkills([...current, skill]),
    );
  }, []);

  const sync = useCallback(async () => {
    await run({ kind: "sync", options: { skills: selected, dryRun: false } });
    onStateChanged();
  }, [onStateChanged, run, selected]);

  return (
    <GentleSection
      id="skills"
      title="Skills"
      description={
        usesDefaults
          ? `All ${GENTLE_AI_SKILLS.length} default skills are installed. Selecting skills below pins an explicit set instead.`
          : `${installed.length} of ${GENTLE_AI_SKILLS.length} skills are pinned on this machine.`
      }
      action={
        <Button
          size="xs"
          onClick={() => void sync()}
          disabled={isRunning || !isAvailable || selected.length === 0}
        >
          Sync {selected.length} selected
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            nativeInput
            type="search"
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search skills"
            aria-label="Search skills"
            className="[&_[data-slot=input]]:pl-7.5"
          />
        </div>
        <ToggleGroup
          aria-label="Skill category"
          variant="segmented"
          value={[category]}
          onValueChange={(next) => {
            const value = next[0];
            if (CATEGORY_FILTERS.some((filter) => filter.value === value)) {
              setCategory(value as CategoryFilter);
            }
          }}
        >
          {CATEGORY_FILTERS.map((filter) => (
            <Toggle key={filter.value} value={filter.value}>
              {filter.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      {visible.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-border/60 bg-card/30 px-4 py-8 text-center text-[0.8125rem] text-muted-foreground"
        >
          No skills match “{query}”.
        </p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((skill) => {
            const isSelected = selected.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={skill.name}
                onClick={() => toggle(skill.id)}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-3 text-left outline-none transition-[background-color,border-color] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-primary/56 bg-primary/8"
                    : "border-border/60 bg-card/30 hover:border-border hover:bg-accent/32",
                )}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="min-w-0 text-[0.8125rem] font-medium text-foreground">
                    {skill.name}
                  </span>
                  {usesDefaults ? (
                    <Badge size="sm" variant="outline">
                      default set
                    </Badge>
                  ) : isSkillInstalled(skill.id, installed) ? (
                    <Badge size="sm" variant="success">
                      installed
                    </Badge>
                  ) : null}
                </span>
                <span className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {skill.description}
                </span>
                <span className="text-[0.625rem] tracking-wide text-muted-foreground/70 uppercase">
                  {GENTLE_AI_SKILL_CATEGORY_LABELS[skill.category]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GentleSection>
  );
}
