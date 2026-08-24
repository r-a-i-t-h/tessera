import type { Skin } from "@r-a-i-t-h/tessera-renderer";

const roleClasses: Record<string, string> = {
  content: "w3-content",
  main: "w3-container",
  footer: "w3-container w3-padding-16 w3-center",
  header: "w3-container",
  sidebar: "w3-container",
  stack: "w3-section",
  row: "w3-row",
};

/** Map layout region roles to W3.CSS 5 class names. */
export const w3Skin: Skin = {
  regionClass(role, className) {
    const fromRole = role ? roleClasses[role] ?? "" : "";
    return [fromRole, className].filter(Boolean).join(" ");
  },
};

export function w3Panel(html: string, colorClass = "w3-theme-l4"): string {
  return `<div class="w3-panel ${colorClass} w3-padding">${html}</div>`;
}

export function w3Quote(html: string): string {
  return `<blockquote class="w3-panel w3-leftbar w3-light-grey"><p>${html}</p></blockquote>`;
}
