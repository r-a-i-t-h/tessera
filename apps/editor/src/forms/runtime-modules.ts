import { activateDialog, type DialogController } from "../dialog.js";
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
  const title = escapeHtml(mod.title?.trim() || mod.id);
  return `<div class="runtime-module-editor">
    <h3 class="runtime-module-heading">${title}</h3>
    <p class="w3-small runtime-module-url"><code>${escapeHtml(mod.url)}</code></p>
    <form data-runtime-raw>
      <h3 class="runtime-module-dialog-title">${title}</h3>
      <p class="runtime-module-tools"><button type="button" class="w3-button w3-small w3-white" data-runtime-maximize>Maximize</button></p>
      <p class="runtime-module-editor-area"><label>Raw file <textarea name="text" class="w3-input w3-border editor-html" rows="24" spellcheck="false">${escapeHtml(raw)}</textarea></label></p>
      <p class="runtime-module-actions">
        <button type="submit" class="w3-button w3-theme">Save</button>
        <button type="button" class="w3-button w3-white runtime-module-normalize" data-runtime-normalize>Normalize</button>
        <button type="button" data-runtime-delete class="w3-button w3-right">Delete</button>
      </p>
    </form>
  </div>`;
}

export function bindRuntimeModuleEditor(root: ParentNode): void {
  const editor = root.querySelector<HTMLElement>(".runtime-module-editor");
  const form = root.querySelector<HTMLFormElement>("[data-runtime-raw]");
  if (!editor || !form) return;

  const maximize = form.querySelector<HTMLButtonElement>("[data-runtime-maximize]");
  const normalize = form.querySelector<HTMLButtonElement>("[data-runtime-normalize]");
  let overlay: HTMLDivElement | null = null;
  const dialogs = new WeakMap<HTMLElement, DialogController>();

  const restore = () => {
    dialogs.get(editor)?.destroy();
    dialogs.delete(editor);
    editor.classList.remove("runtime-module-editor--maximized");
    editor.appendChild(form);
    overlay?.remove();
    overlay = null;
    form.removeAttribute("role");
    form.removeAttribute("aria-modal");
    form.removeAttribute("tabindex");
  };

  maximize?.addEventListener("click", () => {
    if (!maximize || !normalize) return;
    editor.classList.add("runtime-module-editor--maximized");
    overlay = document.createElement("div");
    overlay.className = "runtime-module-overlay-host";
    document.body.appendChild(overlay);
    overlay.appendChild(form);
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.tabIndex = -1;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
    textarea?.focus();
    dialogs.set(
      editor,
      activateDialog(overlay, {
        onCancel: restore,
        returnFocus: maximize,
        initialFocus: 'textarea[name="text"]',
      }),
    );
  });
  normalize?.addEventListener("click", restore);
}
