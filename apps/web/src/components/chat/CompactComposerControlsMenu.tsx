import { GentleAiFlowId, ProviderInteractionMode, RuntimeMode } from "@t3tools/contracts";
import { Fragment, memo, type ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import {
  ORGANIC_FLOW_VALUE,
  gentleFlowFromSelectValue,
  type GentleFlowOptionGroup,
} from "./gentleFlow.logic";
import { useComposerMenuState } from "./useComposerMenuState";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  showInteractionModeToggle: boolean;
  traitsMenuContent?: ReactNode;
  /** Gentle AI flow section; omitted when the picker is hidden or still inline. */
  gentleFlow?: {
    readonly flow: GentleAiFlowId | null;
    readonly groups: ReadonlyArray<GentleFlowOptionGroup>;
    readonly onFlowChange: (flow: GentleAiFlowId | null) => void;
  };
  size?: "sm" | "xs";
  /**
   * The resting strip keeps this menu mounted out of flow while every block
   * fits inline. Its portaled popup would outlive that transition, so an
   * open menu closes when its trigger hides.
   */
  hidden?: boolean;
  onToggleInteractionMode: () => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const gentleFlow = props.gentleFlow;

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={
          <ComposerControl
            size={size}
            variant="ghost"
            className={size === "xs" ? "shrink-0" : "shrink-0 px-2"}
            aria-label="More composer controls"
            data-composer-shortcut={
              props.traitsMenuContent ? "composer.mode composer.effort" : "composer.mode"
            }
          />
        }
      >
        <ComposerControlIcon icon={EllipsisIcon} size={size} />
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            <MenuDivider />
          </>
        ) : null}
        {props.showInteractionModeToggle ? (
          <>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
            <MenuRadioGroup
              value={props.interactionMode}
              onValueChange={(value) => {
                if (!value || value === props.interactionMode) return;
                props.onToggleInteractionMode();
              }}
            >
              <MenuRadioItem value="default">Chat</MenuRadioItem>
              <MenuRadioItem value="plan">Plan</MenuRadioItem>
            </MenuRadioGroup>
            <MenuDivider />
          </>
        ) : null}
        <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Access</div>
        <MenuRadioGroup
          value={props.runtimeMode}
          onValueChange={(value) => {
            if (!value || value === props.runtimeMode) return;
            props.onRuntimeModeChange(value as RuntimeMode);
          }}
        >
          <MenuRadioItem value="approval-required">Supervised</MenuRadioItem>
          <MenuRadioItem value="auto-accept-edits">Auto-accept edits</MenuRadioItem>
          <MenuRadioItem value="auto">Auto</MenuRadioItem>
          <MenuRadioItem value="full-access">Full access</MenuRadioItem>
        </MenuRadioGroup>
        {gentleFlow ? (
          <>
            <MenuDivider />
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Flow</div>
            <MenuRadioGroup
              value={gentleFlow.flow ?? ORGANIC_FLOW_VALUE}
              onValueChange={(value) => {
                const next = gentleFlowFromSelectValue(typeof value === "string" ? value : null);
                if (next === gentleFlow.flow) return;
                gentleFlow.onFlowChange(next);
              }}
              data-gentle-flow-menu="true"
            >
              {gentleFlow.groups.map((group) => (
                <Fragment key={group.group}>
                  {group.group === "organic" ? null : (
                    <div className="px-2 pt-1.5 pb-0.5 text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wide">
                      {group.label}
                    </div>
                  )}
                  {group.options.map((option) => (
                    <MenuRadioItem
                      key={option.id}
                      value={option.id}
                      data-gentle-flow-option={option.id}
                    >
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate">{option.label}</span>
                        {option.hint ? (
                          <span className="truncate text-[0.6875rem] text-muted-foreground/70">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                    </MenuRadioItem>
                  ))}
                </Fragment>
              ))}
            </MenuRadioGroup>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
