import { escapeHtml } from "../dom.js";
import type { RuntimeModuleAsset } from "../api.js";

export function renderRuntimeModulesList(modules: RuntimeModuleAsset[], selectedId?: string): string {
  const rows = modules
    .map((mod) => {
      const label = mod.title?.trim() || mod.id;
      const active = mod.id === selectedId ? " w3-light-grey" : "";
      return `<li><a class="w3-bar-item w3-button w3-border-bottom${active}" href="#/runtime-modules/${encodeURIComponent(mod.id)}">${escapeHtml(label)}</a></li>`;
    })
    .join("");
  return `<div class="w3-row-padding">
    <div class="w3-third">
      <h2>Runtime modules</h2>
      <p class="w3-small">Client-side only. Tessera does not run this code on the server.</p>
      <ul class="w3-ul w3-border">${rows || "<li class=\"w3-padding\">No modules yet.</li>"}</ul>
      <form data-runtime-upload class="w3-margin-top">
        <p><label>Upload .js / .mjs <input type="file" name="file" accept=".js,.mjs" required /></label></p>
        <p><button type="submit" class="w3-button w3-theme">Upload</button></p>
      </form>
    </div>
    <div class="w3-twothird" data-runtime-detail>${selectedId ? "" : "<p class=\"w3-text-grey\">Select a module.</p>"}</div>
  </div>`;
}

export function renderRuntimeModuleDetail(mod: RuntimeModuleAsset, raw: string): string {
  return `<h3>${escapeHtml(mod.title?.trim() || mod.id)}</h3>
    <p class="w3-small"><code>${escapeHtml(mod.url)}</code></p>
    <form data-runtime-raw>
      <p><label>Raw file <textarea name="text" class="w3-input w3-border editor-html" rows="24" spellcheck="false">${escapeHtml(raw)}</textarea></label></p>
      <p><button type="submit" class="w3-button w3-theme">Save</button>
        <button type="button" data-runtime-delete class="w3-button w3-right">Delete</button></p>
    </form>`;
}
