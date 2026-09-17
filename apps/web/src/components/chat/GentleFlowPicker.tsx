import type { GentleAiFlowId } from "@t3tools/contracts";
import { FlowerIcon } from "lucide-react";
import { Fragment, memo } from "react";

import { cn } from "~/lib/utils";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectValue,
} from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ComposerControlIcon, ComposerSelectControl } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import {
  ORGANIC_FLOW_VALUE,
  gentleFlowAccent,
  gentleFlowFromSelectValue,
  gentleFlowShortLabel,
  type GentleFlowOptionGroup,
} from "./gentleFlow.logic";
import { useComposerMenuState } from "./useComposerMenuState";

/**
 * Footer control that puts the composer into a Gentle AI flow. Sits beside the
 * runtime-mode select and shares its sizing; the trigger takes the group
 * accent as its text colour while a flow is active so the choice reads even
 * when the frame accent is off-screen.
 */
export const GentleFlowPicker = memo(function GentleFlowPicker(props: {
  flow: GentleAiFlowId | null;
  groups: ReadonlyArray<GentleFlowOptionGroup>;
  size?: "sm" | "xs";
  hidden?: boolean;
  onFlowChange: (flow: GentleAiFlowId | null) => void;
}) {
  const size = props.size ?? "sm";
  const composerFloatingLayerProps = useComposerMenuProps();
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const accent = gentleFlowAccent(props.flow);
  const active = props.groups
    .flatMap((group) => group.options)
    .find((option) => option.id === (props.flow ?? ORGANIC_FLOW_VALUE));
  const tooltip = active
    ? active.hint
      ? `${active.description} ${active.hint[0]?.toUpperCase()}${active.hint.slice(1)}.`
      : active.description
    : "Gentle AI flow";

  return (
    <Tooltip>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={props.flow ?? ORGANIC_FLOW_VALUE}
        onValueChange={(value) => props.onFlowChange(gentleFlowFromSelectValue(value))}
      >
        <TooltipTrigger
          render={
            <ComposerSelectControl
              size={size}
              className={cn(
                size === "xs" ? undefined : "font-medium",
                accent && "hover:opacity-90",
              )}
              style={accent ? { color: accent } : undefined}
              aria-label="Gentle AI flow"
              data-gentle-flow-picker="true"
              data-gentle-flow={props.flow ?? ORGANIC_FLOW_VALUE}
            />
          }
        >
          <ComposerControlIcon
            icon={FlowerIcon}
            size={size}
            className={accent ? "text-current opacity-100" : undefined}
          />
          <SelectValue>{gentleFlowShortLabel(props.flow)}</SelectValue>
        </TooltipTrigger>
        <SelectPopup
          alignItemWithTrigger={false}
          matchTriggerWidth={false}
          className="max-h-[min(60vh,32rem,var(--available-height))]"
          {...composerFloatingLayerProps}
        >
          {props.groups.map((group, index) => (
            <Fragment key={group.group}>
              {index > 0 ? <SelectSeparator /> : null}
              <SelectGroup>
                <SelectGroupLabel>{group.label}</SelectGroupLabel>
                {group.options.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    hideIndicator
                    className="min-w-72 py-2"
                    data-gentle-flow-option={option.id}
                  >
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        {option.label}
                        {option.hint ? (
                          <span
                            className={cn(
                              "truncate font-normal text-[0.6875rem] tabular-nums",
                              option.installed
                                ? "text-muted-foreground"
                                : "text-muted-foreground/60",
                            )}
                          >
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-xs leading-4">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </Fragment>
          ))}
        </SelectPopup>
      </Select>
      <TooltipPopup side="top" className="max-w-80">
        {tooltip}
      </TooltipPopup>
    </Tooltip>
  );
});
