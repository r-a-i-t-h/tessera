import {
  STYLE_DEFAULTS,
  resolveSiteStyle,
  styleIssue,
  type SiteStyle,
} from "@r-a-i-t-h/tessera-model";

export type StyleFieldKind = "size" | "font" | "url" | "color" | "side";

export type StyleField = {
  name: keyof SiteStyle;
  label: string;
  group: string;
  kind: StyleFieldKind;
};

export const STYLE_FIELDS: StyleField[] = [
  { name: "sidebarWidth", label: "Sidebar width", group: "Dimensions", kind: "size" },
  { name: "barHeight", label: "Bar height", group: "Dimensions", kind: "size" },
  { name: "contentMaxWidth", label: "Content width", group: "Dimensions", kind: "size" },
  { name: "baseFontSize", label: "Base font size", group: "Dimensions", kind: "size" },
  { name: "fontA", label: "Font A", group: "Fonts", kind: "font" },
  { name: "fontB", label: "Font B", group: "Fonts", kind: "font" },
  { name: "fontC", label: "Font C", group: "Fonts", kind: "font" },
  { name: "fontD", label: "Font D", group: "Fonts", kind: "font" },
  { name: "fontsHref", label: "Fonts stylesheet", group: "Fonts", kind: "url" },
  { name: "navSide", label: "Menu side", group: "Menu", kind: "side" },
  { name: "bar", label: "Bar", group: "Colours", kind: "color" },
  { name: "barText", label: "Bar text", group: "Colours", kind: "color" },
  { name: "sidebar", label: "Sidebar", group: "Colours", kind: "color" },
  { name: "sidebarText", label: "Sidebar text", group: "Colours", kind: "color" },
  { name: "page", label: "Page background", group: "Colours", kind: "color" },
  { name: "text", label: "Text", group: "Colours", kind: "color" },
  { name: "muted", label: "Muted", group: "Colours", kind: "color" },
  { name: "accent", label: "Accent", group: "Colours", kind: "color" },
  { name: "link", label: "Link", group: "Colours", kind: "color" },
];

/** Form values for a site record, with defaults filled in for blank tokens. */
export function styleFieldValues(record: Record<string, unknown>): Required<SiteStyle> {
  const raw = isStyle(record.style) ? record.style : {};
  return resolveSiteStyle(raw);
}

/** Field text as a style object. Invalid tokens are left for `styleIssue` or CSS fallback. */
export function styleDraft(values: Record<string, string>): SiteStyle {
  const style: SiteStyle = {};
  for (const field of STYLE_FIELDS) {
    const value = values[field.name]?.trim() ?? "";
    if (!value) continue;
    if (field.name === "navSide") {
      if (value === "left" || value === "right") style.navSide = value;
      continue;
    }
    style[field.name] = value;
  }
  return style;
}

/** Read posted field values. Invalid text is reported and not saved. */
export function styleFromValues(values: Record<string, string>): { ok: true; style: SiteStyle } | { ok: false; error: string } {
  const style = styleDraft(values);
  const side = values.navSide?.trim();
  if (side && side !== "left" && side !== "right") return { ok: false, error: "Menu side must be left or right." };
  const error = styleIssue(style);
  if (error) return { ok: false, error };
  return { ok: true, style };
}

export function styleGroups(): { group: string; fields: StyleField[] }[] {
  const groups: { group: string; fields: StyleField[] }[] = [];
  for (const field of STYLE_FIELDS) {
    const current = groups[groups.length - 1];
    if (!current || current.group !== field.group) groups.push({ group: field.group, fields: [field] });
    else current.fields.push(field);
  }
  return groups;
}

export { STYLE_DEFAULTS };

function isStyle(value: unknown): value is SiteStyle {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
