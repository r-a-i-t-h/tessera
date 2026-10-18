import type { Skin } from "@r-a-i-t-h/tessera-renderer";

/** W3.CSS classes merged onto a layout region when its YAML `role` matches. */
export const W3_REGION_CLASS_BY_ID: Record<string, string> = {
  content: "w3-content",
  main: "w3-container",
  footer: "w3-container w3-padding-16 w3-center",
  header: "w3-container",
  sidebar: "w3-container",
  stack: "w3-section",
  row: "w3-row",
};

export type W3RegionPreset = {
  id: keyof typeof W3_REGION_CLASS_BY_ID & string;
  label: string;
};

/** Known skin presets for the layout editor (YAML field `role`). */
export const W3_REGION_PRESETS: readonly W3RegionPreset[] = [
  { id: "content", label: "Content" },
  { id: "main", label: "Main" },
  { id: "header", label: "Header" },
  { id: "sidebar", label: "Sidebar" },
  { id: "footer", label: "Footer" },
  { id: "stack", label: "Stack" },
  { id: "row", label: "Row (multi-column)" },
];

export function w3RegionPresetClasses(id: string | undefined): string {
  if (!id?.trim()) return "";
  return W3_REGION_CLASS_BY_ID[id.trim()] ?? "";
}

export function isKnownW3RegionPreset(id: string | undefined): boolean {
  if (!id?.trim()) return false;
  return id.trim() in W3_REGION_CLASS_BY_ID;
}

/** Map layout region roles to W3.CSS 5 class names. */
export const w3Skin: Skin = {
  regionClass(role, className) {
    const fromRole = w3RegionPresetClasses(role);
    return [fromRole, className].filter(Boolean).join(" ");
  },
};

export function w3Panel(html: string, colorClass = "w3-theme-l4"): string {
  return `<div class="w3-panel ${colorClass} w3-padding">${html}</div>`;
}

export function w3Quote(html: string): string {
  return `<blockquote class="w3-panel w3-leftbar w3-light-grey"><p>${html}</p></blockquote>`;
}
