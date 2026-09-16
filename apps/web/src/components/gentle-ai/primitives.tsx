/**
 * Local layout primitives for the Gentle AI hub.
 *
 * The design system ships no card or tabs primitive, so the hub owns the few
 * shapes it repeats: a bordered panel, a section frame with an anchor the
 * in-page nav scrolls to, a labelled key/value row, and a status pill. Colours
 * come from theme variables so the hub stays legible in every theme; the rose
 * accent is applied as a decorative glow only.
 *
 * @module components/gentle-ai/primitives
 */
import { CircleCheckIcon, CircleSlashIcon, TriangleAlertIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** The gentle-ai brand rose, used for decorative glows and accent rings only. */
export const GENTLE_ROSE = "#f095c8";

export function GentleCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 p-4 shadow-xs/5 backdrop-blur-[1px]",
        className,
      )}
      {...props}
    />
  );
}

export function GentleCardTitle({
  icon,
  action,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...props}>
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        <span className="truncate">{children}</span>
      </h3>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  );
}

/**
 * One hub section. The `id` is the scroll anchor the in-page nav targets, and
 * `scroll-mt` keeps the heading clear of the sticky nav above it.
 */
export function GentleSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-heading`}
            className="text-base font-medium tracking-[-0.01em] text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * A quiet key/value line, for paths, versions, and timestamps. Long values are
 * truncated, and a truncated string gets a tooltip with the whole value -- an
 * absolute path is unusable when only its first half is visible.
 */
export function GentleField({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly mono?: boolean;
}) {
  const valueClassName = cn(
    "min-w-0 truncate text-right text-foreground/90",
    mono && "font-mono text-[0.75rem]",
  );
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[0.8125rem]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {typeof value === "string" && value.length > 32 ? (
        <Tooltip>
          <TooltipTrigger
            delay={300}
            render={<span className={cn(valueClassName, "cursor-default")} />}
          >
            {value}
          </TooltipTrigger>
          <TooltipPopup side="top" className="max-w-96 break-all">
            {value}
          </TooltipPopup>
        </Tooltip>
      ) : (
        <span className={valueClassName}>{value}</span>
      )}
    </div>
  );
}

export type GentleStatusTone = "ok" | "warn" | "fail" | "muted" | "accent";

const TONE_CLASS: Readonly<Record<GentleStatusTone, string>> = {
  ok: "border-success/28 bg-success/8 text-success-foreground",
  warn: "border-warning/28 bg-warning/8 text-warning-foreground",
  fail: "border-destructive/28 bg-destructive/8 text-destructive-foreground",
  muted: "border-border/60 bg-muted/24 text-muted-foreground",
  accent: "border-primary/32 bg-primary/8 text-foreground",
};

/** A compact status pill: binary, engram, RDD, persona, preset. */
export function GentlePill({
  tone = "muted",
  icon,
  label,
  value,
  className,
}: {
  readonly tone?: GentleStatusTone;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly value?: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon}
      <span className="text-muted-foreground">{label}</span>
      {value === undefined ? null : <span className="text-foreground">{value}</span>}
    </span>
  );
}

/** ok / warn / fail glyph shared by the doctor list and the feature rows. */
export function GentleStatusIcon({
  status,
  className,
}: {
  readonly status: "ok" | "warn" | "fail";
  readonly className?: string;
}) {
  const shared = cn("size-4 shrink-0", className);
  if (status === "ok") return <CircleCheckIcon className={cn(shared, "text-success")} />;
  if (status === "warn") return <TriangleAlertIcon className={cn(shared, "text-warning")} />;
  return <CircleSlashIcon className={cn(shared, "text-destructive")} />;
}

/** A thin progress bar for task and artifact completion. */
export function GentleProgress({
  completed,
  total,
  label,
}: {
  readonly completed: number;
  readonly total: number;
  readonly label: string;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[0.6875rem] text-foreground/80">
          {completed}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** A selectable tile used by the agent grid, preset cards, and persona cards. */
export function GentleTile({
  selected = false,
  disabled = false,
  onSelect,
  role = "checkbox",
  className,
  children,
  ariaLabel,
}: {
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: (() => void) | undefined;
  readonly role?: "checkbox" | "radio" | "button";
  readonly className?: string;
  readonly children: ReactNode;
  readonly ariaLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      {...(role === "button" ? {} : { role, "aria-checked": selected })}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-64",
        selected
          ? "border-primary/56 bg-primary/8 shadow-xs/5"
          : "border-border/60 bg-card/30 hover:border-border hover:bg-accent/32",
        className,
      )}
    >
      {children}
    </button>
  );
}
