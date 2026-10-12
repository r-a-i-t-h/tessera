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

type TokenKind = "size" | "color" | "font";

const CSS_TOKENS: readonly { key: keyof SiteStyle; prop: string; kind: TokenKind }[] = [
  { key: "sidebarWidth", prop: "--tessera-sidebar-width", kind: "size" },
  { key: "barHeight", prop: "--tessera-bar-height", kind: "size" },
  { key: "contentMaxWidth", prop: "--tessera-content-max", kind: "size" },
  { key: "baseFontSize", prop: "--tessera-font-size", kind: "size" },
  { key: "fontA", prop: "--tessera-font-a", kind: "font" },
  { key: "fontB", prop: "--tessera-font-b", kind: "font" },
  { key: "fontC", prop: "--tessera-font-c", kind: "font" },
  { key: "fontD", prop: "--tessera-font-d", kind: "font" },
  { key: "bar", prop: "--tessera-bar", kind: "color" },
  { key: "barText", prop: "--tessera-bar-text", kind: "color" },
  { key: "sidebar", prop: "--tessera-sidebar", kind: "color" },
  { key: "sidebarText", prop: "--tessera-sidebar-text", kind: "color" },
  { key: "page", prop: "--tessera-page", kind: "color" },
  { key: "text", prop: "--tessera-text", kind: "color" },
  { key: "muted", prop: "--tessera-muted", kind: "color" },
  { key: "accent", prop: "--tessera-accent", kind: "color" },
  { key: "link", prop: "--tessera-link", kind: "color" },
];

/** Every resolved token. The Styles specimen uses this because it does not load `tessera.css`. */
export function siteStyleCss(style: SiteStyle | undefined, selector = ":root"): string {
  const resolved = resolveSiteStyle(style);
  const lines = CSS_TOKENS.map((token) => `${token.prop}: ${formatToken(token.kind, tokenText(resolved, token.key))};`);
  return cssBlock(selector, lines);
}

/**
 * Custom properties for tokens set on `style` that differ from the Tessera defaults.
 * Unset and default values stay in `tessera.css`, so editing that file shows in the preview.
 */
export function siteStyleOverrideCss(style: SiteStyle | undefined, selector = ":root"): string {
  const lines: string[] = [];
  for (const token of CSS_TOKENS) {
    const raw = style?.[token.key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!tokenValid(token.kind, value)) continue;
    const fallback = STYLE_DEFAULTS[token.key];
    if (typeof fallback !== "string" || sameToken(token.kind, value, fallback)) continue;
    lines.push(`${token.prop}: ${formatToken(token.kind, value)};`);
  }
  return cssBlock(selector, lines);
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

function cssBlock(selector: string, lines: string[]): string {
  if (!lines.length) return "";
  const sel = SELECTOR.test(selector) ? selector : ":root";
  return `${sel} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}`;
}

function tokenText(style: Required<SiteStyle>, key: keyof SiteStyle): string {
  const value = style[key];
  return typeof value === "string" ? value : "";
}

function formatToken(kind: TokenKind, value: string): string {
  return kind === "font" ? fontStack(value) : value;
}

function tokenValid(kind: TokenKind, value: string): boolean {
  if (kind === "size") return SIZE.test(value);
  if (kind === "color") return COLOR.test(value);
  return FONT.test(value);
}

function sameToken(kind: TokenKind, value: string, fallback: string): boolean {
  if (kind === "color") return value.toLowerCase() === fallback.toLowerCase();
  return value === fallback;
}

function fontStack(name: string): string {
  return `"${name.replace(/["\\]/g, "")}", sans-serif`;
}

function label(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
