import { z } from "zod";

/** Optional chrome tokens. Absent fields keep the ineffable-sized defaults. */
export const SiteStyleSchema = z.object({
  sidebarWidth: z.string().optional(),
  barHeight: z.string().optional(),
  contentMaxWidth: z.string().optional(),
  baseFontSize: z.string().optional(),
  fontA: z.string().optional(),
  fontB: z.string().optional(),
  fontC: z.string().optional(),
  fontD: z.string().optional(),
  fontsHref: z.string().optional(),
  navSide: z.enum(["left", "right"]).optional(),
  bar: z.string().optional(),
  barText: z.string().optional(),
  sidebar: z.string().optional(),
  sidebarText: z.string().optional(),
  page: z.string().optional(),
  text: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  link: z.string().optional(),
});

export type SiteStyle = z.infer<typeof SiteStyleSchema>;

export const STYLE_DEFAULTS: Required<SiteStyle> = {
  sidebarWidth: "300px",
  barHeight: "42px",
  contentMaxWidth: "1100px",
  baseFontSize: "16px",
  fontA: "Lekton",
  fontB: "Roboto",
  fontC: "Orbitron",
  fontD: "Thasadith",
  fontsHref: "https://fonts.googleapis.com/css?family=Lekton|Roboto|Orbitron|Thasadith",
  navSide: "right",
  bar: "#009688",
  barText: "#ffffff",
  sidebar: "#ffffff",
  sidebarText: "#111111",
  page: "#ffffff",
  text: "#111111",
  muted: "#666666",
  accent: "#009688",
  link: "#00796b",
};

const SIZE = /^\d+(\.\d+)?(px|rem|em|%)$/;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FONT = /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,80}$/;
const HREF = /^https:\/\/[^\s"'<>\\]{1,500}$/;
const SELECTOR = /^(:root|\.[A-Za-z][\w-]*)$/;

const SIZE_KEYS = ["sidebarWidth", "barHeight", "contentMaxWidth", "baseFontSize"] as const;
const COLOR_KEYS = ["bar", "barText", "sidebar", "sidebarText", "page", "text", "muted", "accent", "link"] as const;
const FONT_KEYS = ["fontA", "fontB", "fontC", "fontD"] as const;

/** Why a provided token cannot be written into CSS. Empty fields are skipped. */
export function styleIssue(style: SiteStyle | undefined): string | undefined {
  if (!style) return undefined;
  for (const key of SIZE_KEYS) {
    const value = style[key]?.trim();
    if (value && !SIZE.test(value)) return `${label(key)} must be a length such as 300px.`;
  }
  for (const key of COLOR_KEYS) {
    const value = style[key]?.trim();
    if (value && !COLOR.test(value)) return `${label(key)} must be a hex colour such as #009688.`;
  }
  for (const key of FONT_KEYS) {
    const value = style[key]?.trim();
    if (value && !FONT.test(value)) return `${label(key)} must be a font family name.`;
  }
  const href = style.fontsHref?.trim();
  if (href && !HREF.test(href)) return "Fonts stylesheet must be an https URL.";
  return undefined;
}

/** Defaults filled in. Invalid provided values fall back rather than breaking the page. */
export function resolveSiteStyle(style: SiteStyle | undefined): Required<SiteStyle> {
  const source = style ?? {};
  return {
    sidebarWidth: size(source.sidebarWidth, STYLE_DEFAULTS.sidebarWidth),
    barHeight: size(source.barHeight, STYLE_DEFAULTS.barHeight),
    contentMaxWidth: size(source.contentMaxWidth, STYLE_DEFAULTS.contentMaxWidth),
    baseFontSize: size(source.baseFontSize, STYLE_DEFAULTS.baseFontSize),
    fontA: font(source.fontA, STYLE_DEFAULTS.fontA),
    fontB: font(source.fontB, STYLE_DEFAULTS.fontB),
    fontC: font(source.fontC, STYLE_DEFAULTS.fontC),
    fontD: font(source.fontD, STYLE_DEFAULTS.fontD),
    fontsHref: href(source.fontsHref, STYLE_DEFAULTS.fontsHref),
    navSide: source.navSide === "left" ? "left" : source.navSide === "right" ? "right" : STYLE_DEFAULTS.navSide,
    bar: color(source.bar, STYLE_DEFAULTS.bar),
    barText: color(source.barText, STYLE_DEFAULTS.barText),
    sidebar: color(source.sidebar, STYLE_DEFAULTS.sidebar),
    sidebarText: color(source.sidebarText, STYLE_DEFAULTS.sidebarText),
    page: color(source.page, STYLE_DEFAULTS.page),
    text: color(source.text, STYLE_DEFAULTS.text),
    muted: color(source.muted, STYLE_DEFAULTS.muted),
    accent: color(source.accent, STYLE_DEFAULTS.accent),
    link: color(source.link, STYLE_DEFAULTS.link),
  };
}

/** Custom properties for the resolved tokens. `selector` is `:root` on the site. */
export function siteStyleCss(style: SiteStyle | undefined, selector = ":root"): string {
  const sel = SELECTOR.test(selector) ? selector : ":root";
  const resolved = resolveSiteStyle(style);
  const lines = [
    `--tessera-sidebar-width: ${resolved.sidebarWidth};`,
    `--tessera-bar-height: ${resolved.barHeight};`,
    `--tessera-content-max: ${resolved.contentMaxWidth};`,
    `--tessera-font-size: ${resolved.baseFontSize};`,
    `--tessera-font-a: ${fontStack(resolved.fontA)};`,
    `--tessera-font-b: ${fontStack(resolved.fontB)};`,
    `--tessera-font-c: ${fontStack(resolved.fontC)};`,
    `--tessera-font-d: ${fontStack(resolved.fontD)};`,
    `--tessera-bar: ${resolved.bar};`,
    `--tessera-bar-text: ${resolved.barText};`,
    `--tessera-sidebar: ${resolved.sidebar};`,
    `--tessera-sidebar-text: ${resolved.sidebarText};`,
    `--tessera-page: ${resolved.page};`,
    `--tessera-text: ${resolved.text};`,
    `--tessera-muted: ${resolved.muted};`,
    `--tessera-accent: ${resolved.accent};`,
    `--tessera-link: ${resolved.link};`,
  ];
  return `${sel} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}`;
}

/** Body classes for the default font and the menu side. */
export function siteBodyClass(style: SiteStyle | undefined): string {
  const side = resolveSiteStyle(style).navSide === "left" ? "leftnav" : "rightnav";
  return `${side} fontA`;
}

function size(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && SIZE.test(trimmed) ? trimmed : fallback;
}

function color(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && COLOR.test(trimmed) ? trimmed : fallback;
}

function font(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && FONT.test(trimmed) ? trimmed : fallback;
}

function href(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && HREF.test(trimmed) ? trimmed : fallback;
}

function fontStack(name: string): string {
  return `"${name.replace(/["\\]/g, "")}", sans-serif`;
}

function label(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
