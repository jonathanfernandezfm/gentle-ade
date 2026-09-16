import type { SVGProps } from "react";

/**
 * The Gentle ADE mark: a five-petal rose drawn with the current text color so
 * it follows the surrounding lockup, plus an optional tint for the center.
 */
export function GentleWordmark({
  accentColor = "#F095C8",
  ...props
}: SVGProps<SVGSVGElement> & { readonly accentColor?: string }) {
  return (
    <svg {...props} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor">
        <ellipse cx="32" cy="15" rx="9" ry="13" />
        <ellipse cx="32" cy="49" rx="9" ry="13" />
        <ellipse cx="15" cy="32" rx="13" ry="9" />
        <ellipse cx="49" cy="32" rx="13" ry="9" />
        <ellipse cx="20" cy="20" rx="9" ry="12" transform="rotate(-45 20 20)" />
        <ellipse cx="44" cy="20" rx="9" ry="12" transform="rotate(45 44 20)" />
        <ellipse cx="20" cy="44" rx="9" ry="12" transform="rotate(45 20 44)" />
        <ellipse cx="44" cy="44" rx="9" ry="12" transform="rotate(-45 44 44)" />
      </g>
      <circle cx="32" cy="32" r="8.5" fill={accentColor} />
    </svg>
  );
}
