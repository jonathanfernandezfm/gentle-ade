#!/usr/bin/env node

// Renders every Gentle ADE rose icon from SVG strings without Icon Composer.
//
// The Icon Composer projects stay the source of truth for the glyph (each `text.svg` is
// rewritten here so the macOS pipeline keeps working), but on machines without Icon
// Composer this script rasterizes the same artwork with sharp/librsvg: the 1024pt Apple
// and Linux icons, the classic macOS pre-Tahoe safe-area PNG, Windows and web ICOs,
// favicons, the Android adaptive/splash/notification layers and the iOS widget mark.
//
// Two glyph variants exist because the rose is line art: `detailed` keeps the inner
// spiral, petal folds, leaf veins and orbit dots for 128px and up, while `simplified`
// drops them and thickens every stroke so a 16px favicon still reads as a rose.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import sharp from "sharp";

import { BRAND_ASSET_PATHS } from "./lib/brand-assets.ts";
import { encodePngIco, readPngDimensions, WINDOWS_ICON_SIZES } from "./lib/icon-export.ts";

type Channel = "dev" | "nightly" | "prod";
type GlyphVariant = "detailed" | "simplified";

// Every glyph is authored on the Icon Composer layer canvas so `text.svg` and the rasters
// share one coordinate space.
const GLYPH_CANVAS = 128;
const BRAND_PINK = "#F095C8";
const GLOW_PINK = "#FF3F9E";
const CORE_PINK = "#FFE0F0";
// Rendition sizes at or below this use the simplified glyph; at or below FLAT_MAX_SIZE the
// halo is dropped too, because a blurred stroke is wider than the pixel grid there.
const SIMPLIFIED_MAX_SIZE = 64;
const FLAT_MAX_SIZE = 24;
const WEB_FAVICON_ICO_SIZES = [16, 32, 48] as const;
// Apple-style continuous corners: the tracked exports become opaque ~23% of the edge in.
const ROUNDED_CORNER_RATIO = 0.225;
// Classic macOS safe area: an 824pt body inset 100pt on a 1024pt canvas.
const MACOS_CANVAS = 1024;
const MACOS_BODY = 824;
const MACOS_INSET = (MACOS_CANVAS - MACOS_BODY) / 2;
// 108dp adaptive canvas at xxxhdpi; the launcher shows the central 72dp.
const ANDROID_ADAPTIVE_CANVAS = 432;
// 288dp Android 12+ splash canvas; the mask shows the central two thirds.
const ANDROID_SPLASH_CANVAS = 1152;
const ANDROID_NOTIFICATION_CANVAS = 96;
// Fraction of the Android canvases the glyph box occupies so it stays inside the mask.
const ANDROID_GLYPH_FRACTION = 0.58;
const MOBILE_ASSETS_DIRECTORY = "apps/mobile/assets";

const CHANNEL_BACKGROUNDS: Record<Channel, { readonly inner: string; readonly outer: string }> = {
  dev: { inner: "#25207A", outer: "#0D0B2E" },
  nightly: { inner: "#4A1A44", outer: "#170A18" },
  prod: { inner: "#1A1218", outer: "#0B070A" },
};

export class RoseIconRenderError extends Schema.TaggedError<RoseIconRenderError>()(
  "RoseIconRenderError",
  { output: Schema.String, cause: Schema.Defect() },
) {}

const round = (value: number) => Number(value.toFixed(2));

/**
 * Archimedean spiral around the bud, slightly squashed so it reads as petals seen from
 * above rather than a coil. Returned as an SVG path in glyph-canvas units.
 */
function spiralPath(options: {
  readonly cx: number;
  readonly cy: number;
  readonly turns: number;
  readonly startRadius: number;
  readonly endRadius: number;
  readonly squash: number;
}) {
  const steps = Math.ceil(options.turns * 48);
  const totalAngle = options.turns * Math.PI * 2;
  const points: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * totalAngle;
    const radius =
      options.startRadius + ((options.endRadius - options.startRadius) * angle) / totalAngle;
    // Start pointing up so the outer end lands on the left rim of the cup.
    const theta = angle - Math.PI / 2;
    const x = options.cx + radius * Math.cos(theta);
    const y = options.cy + radius * options.squash * Math.sin(theta);
    points.push(`${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`);
  }
  return points.join(" ");
}

interface GlyphStrokes {
  /** Petal outlines, spiral and stem. */
  readonly primary: string[];
  /** Leaf outlines (closed paths so the mark can also be filled). */
  readonly leaves: string[];
  /** Fine detail only drawn in the detailed variant. */
  readonly detail: string[];
  /** Orbit dots as `[cx, cy, r]`. */
  readonly dots: ReadonlyArray<readonly [number, number, number]>;
}

// The bloom sits above center so the stem and leaves balance it; all numbers are in the
// 128pt glyph canvas. Petals are layered from the bud outward: a tight spiral, two crown
// petals rising behind it, the inner cup, two outer petals fanning out to pointed tips,
// and the bowl that closes the bloom over the stem.
function detailedGlyph(): GlyphStrokes {
  return {
    primary: [
      spiralPath({ cx: 64, cy: 41, turns: 2.25, startRadius: 1.5, endRadius: 12, squash: 0.8 }),
      // Crown petals behind the bud.
      "M48 46C42 34 50 22 63 25",
      "M80 46C86 34 78 22 65 25",
      // Inner cup holding the bud.
      "M46 44C44 58 54 66 64 66C74 66 84 58 82 44",
      // Outer petals flaring to pointed tips, with a short inner edge curling back in.
      "M48 70C34 66 24 54 25 40C25 33 28 29 32 27C34 34 39 40 46 44",
      "M80 70C94 66 104 54 103 40C103 33 100 29 96 27C94 34 89 40 82 44",
      // Bowl and the front petal fold.
      "M40 56C42 70 52 78 64 78C76 78 86 70 88 56",
      "M46 60C52 70 76 70 82 60",
      // Stem.
      "M64 78C64 90 63 104 63 118",
    ],
    leaves: [
      "M63 98C54 91 42 95 36 108C46 113 58 108 63 98Z",
      "M64 90C72 83 86 87 92 98C82 104 70 98 64 90Z",
    ],
    detail: [
      // Sepals hugging the stem.
      "M62 79C57 81 52 86 50 92",
      "M66 79C71 81 76 86 78 92",
      // Leaf veins.
      "M60 100C54 102 46 104 40 107",
      "M67 91C74 93 82 95 88 98",
      // Orbit ring behind the bloom.
      "M20 46A46 46 0 0 1 108 46",
      "M24 76A46 46 0 0 1 17 58",
    ],
    dots: [
      [22, 38, 2.2],
      [100, 16, 1.6],
      [110, 60, 2.4],
      [15, 66, 1.4],
      [98, 90, 1.8],
      [42, 12, 1.2],
      [113, 42, 1.1],
    ],
  };
}

// Bigger bloom, fewer petals, one and a half spiral turns, no orbit: this variant renders at
// 64px and below where only the silhouette survives.
function simplifiedGlyph(): GlyphStrokes {
  return {
    primary: [
      spiralPath({ cx: 64, cy: 46, turns: 1.5, startRadius: 3, endRadius: 13, squash: 0.8 }),
      "M47 52C42 38 52 26 64 28",
      "M81 52C86 38 76 26 64 28",
      "M48 76C34 72 24 56 25 40C32 36 40 42 47 52",
      "M80 76C94 72 104 56 103 40C96 36 88 42 81 52",
      "M40 60C42 76 52 84 64 84C76 84 86 76 88 60",
      "M64 84C64 96 63 106 63 118",
    ],
    leaves: [
      "M63 100C54 92 42 96 34 110C46 116 58 110 63 100Z",
      "M64 92C72 84 86 88 94 100C82 108 70 100 64 92Z",
    ],
    detail: [],
    dots: [],
  };
}

interface GlyphStyle {
  readonly variant: GlyphVariant;
  /** Stroke width in glyph-canvas units. */
  readonly strokeWidth: number;
  /** `neon` layers a blurred hot-pink halo under the brand pink; `flat` is a single color. */
  readonly mode: "neon" | "flat";
  readonly color: string;
  readonly fillLeaves: boolean;
}

const strokeAttributes = (color: string, width: number, extra = "") =>
  `fill="none" stroke="${color}" stroke-width="${round(width)}" stroke-linecap="round" stroke-linejoin="round"${extra}`;

function glyphLayer(strokes: GlyphStrokes, color: string, width: number, fillLeaves: boolean) {
  const primary = strokes.primary.map((d) => `<path d="${d}"/>`).join("");
  const leaves = strokes.leaves
    .map((d) => `<path d="${d}"${fillLeaves ? ` fill="${color}"` : ""}/>`)
    .join("");
  const detail = strokes.detail.map((d) => `<path d="${d}"/>`).join("");
  const dots = strokes.dots
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`)
    .join("");
  return `<g ${strokeAttributes(color, width)}>${primary}${leaves}<g stroke-width="${round(width * 0.45)}" opacity="0.8">${detail}</g>${dots}</g>`;
}

/**
 * The rose in glyph-canvas coordinates. `neon` mode emits a `<filter>` so every consumer
 * that inlines this markup needs a unique `id` prefix; icons never share a document.
 */
function glyphMarkup(style: GlyphStyle, idPrefix: string) {
  const strokes = style.variant === "detailed" ? detailedGlyph() : simplifiedGlyph();
  if (style.mode === "flat") {
    return glyphLayer(strokes, style.color, style.strokeWidth, style.fillLeaves);
  }
  const filterId = `${idPrefix}-glow`;
  const filter = `<filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${round(style.strokeWidth * 1.1)}"/></filter>`;
  const halo = `<g filter="url(#${filterId})" opacity="0.85">${glyphLayer(strokes, GLOW_PINK, style.strokeWidth * 1.9, style.fillLeaves)}</g>`;
  const body = glyphLayer(strokes, style.color, style.strokeWidth, style.fillLeaves);
  const core = `<g opacity="0.55">${glyphLayer(strokes, CORE_PINK, style.strokeWidth * 0.35, false)}</g>`;
  return `<defs>${filter}</defs>${halo}${body}${core}`;
}

const styleForSize = (size: number): GlyphStyle =>
  size <= SIMPLIFIED_MAX_SIZE
    ? {
        variant: "simplified",
        strokeWidth: size <= FLAT_MAX_SIZE ? 8.5 : 7.5,
        mode: size <= FLAT_MAX_SIZE ? "flat" : "neon",
        color: BRAND_PINK,
        fillLeaves: true,
      }
    : { variant: "detailed", strokeWidth: 3.4, mode: "neon", color: BRAND_PINK, fillLeaves: false };

/** Icon Composer layer source: the detailed glyph on the transparent 128pt canvas. */
function renderTextLayerSvg() {
  return `<svg width="${GLYPH_CANVAS}" height="${GLYPH_CANVAS}" viewBox="0 0 ${GLYPH_CANVAS} ${GLYPH_CANVAS}" fill="none" xmlns="http://www.w3.org/2000/svg">
${glyphMarkup(styleForSize(1024), "rose")}
</svg>
`;
}

function backgroundDefs(channel: Channel, id: string, cx: number, cy: number, r: number) {
  const colors = CHANNEL_BACKGROUNDS[channel];
  return `<radialGradient id="${id}-bg" cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" gradientUnits="userSpaceOnUse"><stop stop-color="${colors.inner}"/><stop offset="1" stop-color="${colors.outer}"/></radialGradient><radialGradient id="${id}-haze" cx="${round(cx)}" cy="${round(cy * 0.9)}" r="${round(r * 0.75)}" gradientUnits="userSpaceOnUse"><stop stop-color="${GLOW_PINK}" stop-opacity="0.22"/><stop offset="1" stop-color="${GLOW_PINK}" stop-opacity="0"/></radialGradient>`;
}

interface IconSvgOptions {
  readonly channel: Channel;
  readonly size: number;
  /** Rounded corner radius in output pixels; 0 keeps square corners. */
  readonly cornerRadius: number;
  /** Where the icon body sits on the canvas (macOS keeps a transparent safe area). */
  readonly body?: { readonly inset: number; readonly size: number; readonly shadow: boolean };
}

/** A full app icon: channel background, pink haze and the glyph fitted to the body. */
function renderIconSvg(options: IconSvgOptions) {
  const body = options.body ?? { inset: 0, size: options.size, shadow: false };
  const scale = body.size / GLYPH_CANVAS;
  const style = styleForSize(body.size);
  const center = body.inset + body.size / 2;
  const shadow = body.shadow
    ? `<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${round(body.size * 0.018)}"/></filter></defs><rect x="${body.inset}" y="${round(body.inset + body.size * 0.012)}" width="${body.size}" height="${body.size}" rx="${options.cornerRadius}" fill="#000" opacity="0.55" filter="url(#shadow)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 ${options.size} ${options.size}" fill="none">
<defs>${backgroundDefs(options.channel, "icon", center, center * 0.95, body.size * 0.72)}</defs>
${shadow}
<rect x="${body.inset}" y="${body.inset}" width="${body.size}" height="${body.size}" rx="${options.cornerRadius}" fill="url(#icon-bg)"/>
<rect x="${body.inset}" y="${body.inset}" width="${body.size}" height="${body.size}" rx="${options.cornerRadius}" fill="url(#icon-haze)"/>
<g transform="translate(${body.inset} ${body.inset}) scale(${round(scale)})">${glyphMarkup(style, "icon")}</g>
</svg>`;
}

/** Transparent canvas with the glyph box centered and scaled to `fraction` of the canvas. */
function renderGlyphOnlySvg(options: {
  readonly size: number;
  readonly fraction: number;
  readonly style: GlyphStyle;
}) {
  const box = options.size * options.fraction;
  const inset = (options.size - box) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 ${options.size} ${options.size}" fill="none">
<g transform="translate(${round(inset)} ${round(inset)}) scale(${round(box / GLYPH_CANVAS)})">${glyphMarkup(options.style, "glyph")}</g>
</svg>`;
}

/** Full-bleed Android background layer for a channel. */
function renderAndroidBackgroundSvg(channel: Channel, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
<defs>${backgroundDefs(channel, "android", size / 2, size / 2, size * 0.7)}</defs>
<rect width="${size}" height="${size}" fill="url(#android-bg)"/>
<rect width="${size}" height="${size}" fill="url(#android-haze)"/>
</svg>`;
}

/** Standalone production logo on the 128pt canvas, matching the old `logo.svg` framing. */
function renderLogoSvg() {
  const colors = CHANNEL_BACKGROUNDS.prod;
  return `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="logo-bg" cx="64" cy="58" r="92" gradientUnits="userSpaceOnUse"><stop stop-color="${colors.inner}"/><stop offset="1" stop-color="${colors.outer}"/></radialGradient></defs>
<rect width="128" height="128" rx="10" fill="url(#logo-bg)"/>
${glyphMarkup(styleForSize(1024), "logo")}
</svg>
`;
}

/** Monochrome mark for the iOS widget asset catalog (tinted by the widget). */
function renderWidgetMarkSvg() {
  return `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
${glyphMarkup({ variant: "simplified", strokeWidth: 8, mode: "flat", color: "black", fillLeaves: true }, "mark")}
</svg>
`;
}

const rasterize = (output: string, svg: string, size: number) =>
  Effect.tryPromise({
    try: () =>
      sharp(Buffer.from(svg), { density: 300 })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    catch: (cause) => new RoseIconRenderError({ output, cause }),
  });

const composite = (output: string, base: Buffer, overlay: Buffer) =>
  Effect.tryPromise({
    try: () =>
      sharp(base)
        .composite([{ input: overlay }])
        .png({ compressionLevel: 9 })
        .toBuffer(),
    catch: (cause) => new RoseIconRenderError({ output, cause }),
  });

const cornerRadius = (size: number) => round(size * ROUNDED_CORNER_RATIO);

const renderRoundedIcon = (channel: Channel, size: number, output: string) =>
  rasterize(output, renderIconSvg({ channel, size, cornerRadius: cornerRadius(size) }), size);

const renderMacIcon = (channel: Channel, output: string) =>
  rasterize(
    output,
    renderIconSvg({
      channel,
      size: MACOS_CANVAS,
      cornerRadius: cornerRadius(MACOS_BODY),
      body: { inset: MACOS_INSET, size: MACOS_BODY, shadow: true },
    }),
    MACOS_CANVAS,
  );

const renderIco = (channel: Channel, sizes: ReadonlyArray<number>, output: string) =>
  Effect.gen(function* () {
    const images = yield* Effect.forEach(sizes, (size) =>
      Effect.map(renderRoundedIcon(channel, size, `${output}@${size}`), (contents) => ({
        size,
        contents,
      })),
    );
    return encodePngIco(images);
  });

interface ChannelOutputs {
  readonly ios: string;
  readonly universal: string;
  readonly macos: string;
  readonly windowsIco: string;
  readonly faviconIco: string;
  readonly favicon16: string;
  readonly favicon32: string;
  readonly appleTouch: string;
}

const CHANNEL_OUTPUTS: Record<Channel, ChannelOutputs> = {
  dev: {
    ios: BRAND_ASSET_PATHS.developmentIosIconPng,
    universal: BRAND_ASSET_PATHS.developmentUniversalIconPng,
    macos: BRAND_ASSET_PATHS.developmentDesktopIconPng,
    windowsIco: BRAND_ASSET_PATHS.developmentWindowsIconIco,
    faviconIco: BRAND_ASSET_PATHS.developmentWebFaviconIco,
    favicon16: BRAND_ASSET_PATHS.developmentWebFavicon16Png,
    favicon32: BRAND_ASSET_PATHS.developmentWebFavicon32Png,
    appleTouch: BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng,
  },
  nightly: {
    ios: BRAND_ASSET_PATHS.nightlyIosIconPng,
    universal: BRAND_ASSET_PATHS.nightlyLinuxIconPng,
    macos: BRAND_ASSET_PATHS.nightlyMacIconPng,
    windowsIco: BRAND_ASSET_PATHS.nightlyWindowsIconIco,
    faviconIco: BRAND_ASSET_PATHS.nightlyWebFaviconIco,
    favicon16: BRAND_ASSET_PATHS.nightlyWebFavicon16Png,
    favicon32: BRAND_ASSET_PATHS.nightlyWebFavicon32Png,
    appleTouch: BRAND_ASSET_PATHS.nightlyWebAppleTouchIconPng,
  },
  prod: {
    ios: BRAND_ASSET_PATHS.productionIosIconPng,
    universal: BRAND_ASSET_PATHS.productionLinuxIconPng,
    macos: BRAND_ASSET_PATHS.productionMacIconPng,
    windowsIco: BRAND_ASSET_PATHS.productionWindowsIconIco,
    faviconIco: BRAND_ASSET_PATHS.productionWebFaviconIco,
    favicon16: BRAND_ASSET_PATHS.productionWebFavicon16Png,
    favicon32: BRAND_ASSET_PATHS.productionWebFavicon32Png,
    appleTouch: BRAND_ASSET_PATHS.productionWebAppleTouchIconPng,
  },
};

// The web app ships the development brand in its public directory (see
// DEVELOPMENT_PUBLIC_ICON_OVERRIDES); the marketing site ships production.
const PUBLIC_COPIES: ReadonlyArray<{ readonly channel: Channel; readonly directory: string }> = [
  { channel: "dev", directory: "apps/web/public" },
  { channel: "prod", directory: "apps/marketing/public" },
];

interface Output {
  readonly path: string;
  readonly contents: Buffer | string;
}

const describe = (contents: Buffer | string) => {
  if (typeof contents === "string") {
    return "svg";
  }
  if (contents.readUInt16LE(2) === 1 && contents.readUInt16LE(0) === 0) {
    const count = contents.readUInt16LE(4);
    const sizes: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const width = contents.readUInt8(6 + index * 16) || 256;
      sizes.push(`${width}`);
    }
    return `ico ${sizes.join("/")}`;
  }
  const { width, height } = readPngDimensions(contents);
  return `${width}x${height}`;
};

const renderChannel = Effect.fn("roseIcons.renderChannel")(function* (channel: Channel) {
  const outputs = CHANNEL_OUTPUTS[channel];
  const favicon16 = yield* renderRoundedIcon(channel, 16, outputs.favicon16);
  const favicon32 = yield* renderRoundedIcon(channel, 32, outputs.favicon32);
  const appleTouch = yield* renderRoundedIcon(channel, 180, outputs.appleTouch);
  const faviconIco = yield* renderIco(channel, WEB_FAVICON_ICO_SIZES, outputs.faviconIco);
  const files: Output[] = [
    { path: `assets/${channel}/app-icon.icon/Assets/text.svg`, contents: renderTextLayerSvg() },
    { path: outputs.ios, contents: yield* renderRoundedIcon(channel, 1024, outputs.ios) },
    {
      path: outputs.universal,
      contents: yield* renderRoundedIcon(channel, 1024, outputs.universal),
    },
    { path: outputs.macos, contents: yield* renderMacIcon(channel, outputs.macos) },
    {
      path: outputs.windowsIco,
      contents: yield* renderIco(channel, WINDOWS_ICON_SIZES, outputs.windowsIco),
    },
    { path: outputs.faviconIco, contents: faviconIco },
    { path: outputs.favicon16, contents: favicon16 },
    { path: outputs.favicon32, contents: favicon32 },
    { path: outputs.appleTouch, contents: appleTouch },
  ];
  for (const copy of PUBLIC_COPIES) {
    if (copy.channel !== channel) continue;
    files.push(
      { path: `${copy.directory}/favicon.ico`, contents: faviconIco },
      { path: `${copy.directory}/favicon-16x16.png`, contents: favicon16 },
      { path: `${copy.directory}/favicon-32x32.png`, contents: favicon32 },
      { path: `${copy.directory}/apple-touch-icon.png`, contents: appleTouch },
    );
  }
  return files;
});

const renderMobile = Effect.fn("roseIcons.renderMobile")(function* () {
  const detailed = styleForSize(1024);
  const foreground = (size: number, output: string) =>
    rasterize(
      output,
      renderGlyphOnlySvg({ size, fraction: ANDROID_GLYPH_FRACTION, style: detailed }),
      size,
    );
  const white = (size: number, output: string, strokeWidth: number) =>
    rasterize(
      output,
      renderGlyphOnlySvg({
        size,
        fraction: ANDROID_GLYPH_FRACTION,
        style: {
          variant: "simplified",
          strokeWidth,
          mode: "flat",
          color: "white",
          fillLeaves: true,
        },
      }),
      size,
    );
  const splash = (channel: Channel) =>
    Effect.gen(function* () {
      const output = `android-splash-icon-${channel}.png`;
      const background = yield* rasterize(
        output,
        renderAndroidBackgroundSvg(channel, ANDROID_SPLASH_CANVAS),
        ANDROID_SPLASH_CANVAS,
      );
      const glyph = yield* foreground(ANDROID_SPLASH_CANVAS, output);
      return yield* composite(output, background, glyph);
    });
  const files: Output[] = [
    {
      path: "android-icon-foreground.png",
      contents: yield* foreground(ANDROID_ADAPTIVE_CANVAS, "android-icon-foreground.png"),
    },
    {
      path: "android-icon-mark.png",
      contents: yield* white(ANDROID_ADAPTIVE_CANVAS, "android-icon-mark.png", 8),
    },
    {
      path: "android-notification-icon.png",
      contents: yield* white(ANDROID_NOTIFICATION_CANVAS, "android-notification-icon.png", 10),
    },
    {
      path: "android-icon-background-dev.png",
      contents: yield* rasterize(
        "android-icon-background-dev.png",
        renderAndroidBackgroundSvg("dev", ANDROID_ADAPTIVE_CANVAS),
        ANDROID_ADAPTIVE_CANVAS,
      ),
    },
    {
      path: "android-icon-background-nightly.png",
      contents: yield* rasterize(
        "android-icon-background-nightly.png",
        renderAndroidBackgroundSvg("nightly", ANDROID_ADAPTIVE_CANVAS),
        ANDROID_ADAPTIVE_CANVAS,
      ),
    },
    { path: "android-splash-icon-dev.png", contents: yield* splash("dev") },
    { path: "android-splash-icon-nightly.png", contents: yield* splash("nightly") },
    { path: "android-splash-icon-prod.png", contents: yield* splash("prod") },
    { path: "widget/T3Mark.svg", contents: renderWidgetMarkSvg() },
  ];
  return files.map((file) => ({ ...file, path: `${MOBILE_ASSETS_DIRECTORY}/${file.path}` }));
});

const exportRoseIcons = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const outputs: Output[] = [
    ...(yield* renderChannel("dev")),
    ...(yield* renderChannel("nightly")),
    ...(yield* renderChannel("prod")),
    { path: "assets/prod/logo.svg", contents: renderLogoSvg() },
    ...(yield* renderMobile()),
  ];
  for (const output of outputs) {
    const target = path.join(repositoryRoot, output.path);
    if (typeof output.contents === "string") {
      yield* fs.writeFileString(target, output.contents);
    } else {
      yield* fs.writeFile(target, output.contents);
    }
    yield* Console.log(`wrote ${output.path} (${describe(output.contents)})`);
  }
});

if (import.meta.main) {
  exportRoseIcons.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
