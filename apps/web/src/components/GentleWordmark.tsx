import type { SVGProps } from "react";

// The simplified rose from scripts/export-rose-icons.ts, scaled from its 128pt canvas
// into this 64pt box so the bloom fills the lockup at sidebar sizes.
const ROSE_TRANSFORM = "translate(-7.7 -11.6) scale(0.62)";
const BUD_SPIRAL =
  "M64 43.6L65.3 43.5L66.7 43.8L67.9 44.7L68.7 46L68.7 47.6L67.9 49.1L66.3 50.4L64 51.1L61.4 51L58.9 50.1L57 48.3L56 46L56.2 43.4L57.8 41L60.5 39.2L64 38.3L67.9 38.5L71.4 40.1L74.1 42.7L75.3 46L74.9 49.6L72.6 52.9L68.8 55.3L64 56.4";

/**
 * The Gentle ADE mark: a stroked rose drawn with the current text color so it follows
 * the surrounding lockup, with the bud spiral in the brand pink.
 */
export function GentleWordmark({
  accentColor = "#F095C8",
  ...props
}: SVGProps<SVGSVGElement> & { readonly accentColor?: string }) {
  return (
    <svg {...props} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g
        transform={ROSE_TRANSFORM}
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M47 52C42 38 52 26 64 28" />
        <path d="M81 52C86 38 76 26 64 28" />
        <path d="M48 76C34 72 24 56 25 40C32 36 40 42 47 52" />
        <path d="M80 76C94 72 104 56 103 40C96 36 88 42 81 52" />
        <path d="M40 60C42 76 52 84 64 84C76 84 86 76 88 60" />
        <path d="M64 84C64 96 63 106 63 118" />
        <path d="M63 100C54 92 42 96 34 110C46 116 58 110 63 100Z" fill="currentColor" />
        <path d="M64 92C72 84 86 88 94 100C82 108 70 100 64 92Z" fill="currentColor" />
        <path d={BUD_SPIRAL} stroke={accentColor} />
      </g>
    </svg>
  );
}
