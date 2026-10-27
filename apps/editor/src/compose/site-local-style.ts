import { listStylesheets } from "../api.js";

const STYLE_ID = "editor-compose-site-local";

/** Load Site local into the editor so custom panel tone classes preview in Compose. */
export async function syncComposeSiteLocalStyle(): Promise<void> {
  try {
    const sheets = await listStylesheets();
    const local = sheets.find((sheet) => sheet.id === "local");
    const text = local?.text.trim() ?? "";
    const existing = document.getElementById(STYLE_ID);
    if (!text) {
      existing?.remove();
      return;
    }
    const el = existing ?? document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = text;
    if (!existing) document.head.appendChild(el);
  } catch {
    // Compose still works when stylesheets cannot be loaded.
  }
}
