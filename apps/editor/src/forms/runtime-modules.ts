import { activateDialog, type DialogController } from "../dialog.js";
import { escapeHtml } from "../dom.js";
import type { RuntimeModuleAsset } from "../api.js";
import { mountMaximizedCodeEditor, type MaximizedCodeEditorHandle } from "../maximized-code-editor.js";
import { readDataTransfer } from "./drop.js";
import { pageIdError } from "./page.js";

const RUNTIME_MODULE_EXT = /\.(mjs|js)$/i;

export function runtimeModulesRouteHash(id?: string | null): string {
  if (!id) return "#/records/runtimeModules";
  return `#/records/runtimeModules/${encodeURIComponent(id)}`;
}

function isRuntimeModuleFile(file: File): boolean {
  return RUNTIME_MODULE_EXT.test(file.name);
}

function runtimeModuleListItem(mod: RuntimeModuleAsset): string {
  const label = mod.title?.trim() || mod.id;
  const idNote =
    mod.title?.trim() && mod.title.trim() !== mod.id
      ? ` <span class="w3-text-grey w3-small">${escapeHtml(mod.id)}</span>`
      : "";
  const extNote = ` <span class="w3-text-grey w3-small">${escapeHtml(mod.ext)}</span>`;
  return `<li data-runtime-id="${escapeHtml(mod.id)}"><a href="${runtimeModulesRouteHash(mod.id)}">${escapeHtml(label)}</a>${idNote}${extNote}</li>`;
}

export function renderRuntimeModulesList(modules: RuntimeModuleAsset[]): string {
  const rows = modules.map((mod) => runtimeModuleListItem(mod)).join("");
  const browse = modules.length
    ? `<ul class="w3-ul" id="runtime-module-list">${rows}</ul>`
    : `<p class="w3-text-grey">No modules yet.</p>`;
  return `<h1 class="w3-large">Runtime modules</h1>
    <div class="editor-library-split editor-runtime-modules">
      <section class="editor-runtime-modules-browse" aria-label="Modules">
        ${browse}
      </section>
      <div class="editor-library-panels">
        <details id="runtime-module-add" class="w3-card w3-white editor-card editor-library-add" open>
          <summary>Add modules</summary>
          <form data-runtime-upload class="w3-padding editor-drop">
            <p class="w3-text-grey w3-small">Choose or drop .js / .mjs files.</p>
            <p><input type="file" name="file" accept=".js,.mjs" multiple /></p>
            <p id="runtime-upload-status" class="w3-text-grey" hidden></p>
            <p><button type="submit" class="w3-button w3-theme">Upload</button></p>
          </form>
        </details>
      </div>
    </div>`;
}

function runtimeModuleDuplicateToolsHtml(suggestedId: string): string {
  return `<form id="runtime-module-tools" class="w3-card w3-white w3-padding editor-card">
    <p class="editor-rename-row">
      <label for="runtime-module-duplicate-id">Duplicate as</label>
      <input id="runtime-module-duplicate-id" name="duplicate-id" class="w3-input w3-border" value="${escapeHtml(suggestedId)}" autocomplete="off" spellcheck="false" />
      <button type="button" class="w3-button w3-white" data-action="duplicate-runtime-module">Duplicate</button>
    </p>
  </form>`;
}

export function renderRuntimeModulePage(mod: RuntimeModuleAsset, raw: string, duplicateSuggestedId: string): string {
  const title = escapeHtml(mod.title?.trim() || mod.id);
  return `<div class="editor-toolbar">
      <div class="editor-toolbar-row">
        <a class="w3-button w3-white editor-back" href="${runtimeModulesRouteHash()}" aria-label="Back" title="Back (Escape)">←</a>
        <h1 class="w3-large">${title}</h1>
        <p class="editor-actions">
          <button type="submit" form="runtime-module-form" class="w3-button w3-theme">Save</button>
          <button type="button" data-runtime-delete class="w3-button w3-white w3-border w3-border-red">Delete</button>
        </p>
      </div>
    </div>
    ${renderRuntimeModuleDetail(mod, raw)}
    ${runtimeModuleDuplicateToolsHtml(duplicateSuggestedId)}`;
}

function setRuntimeUploadStatus(form: HTMLFormElement, message: string): void {
  const status = form.querySelector<HTMLElement>("#runtime-upload-status");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
}

function runtimeModuleDuplicateIdError(id: string, existingIds: readonly string[]): string | undefined {
  const problem = pageIdError(id, existingIds);
  return problem?.replace("A page with id", "A runtime module with id");
}

export function bindRuntimeModuleDuplicate(
  root: ParentNode,
  sourceId: string,
  existingIds: readonly string[],
  duplicate: (nextId: string) => void | Promise<void>,
  onError: (message: string) => void,
): void {
  root.querySelector<HTMLButtonElement>("[data-action=duplicate-runtime-module]")?.addEventListener("click", () => {
    const input = root.querySelector<HTMLInputElement>('[name="duplicate-id"]');
    const nextId = input?.value.trim() ?? "";
    const problem = runtimeModuleDuplicateIdError(nextId, existingIds);
    if (problem) {
      onError(problem);
      return;
    }
    if (nextId === sourceId) {
      onError("Choose a different id.");
      return;
    }
    if (!window.confirm(`Duplicate ${sourceId} as ${nextId}?`)) return;
    void duplicate(nextId);
  });
}

export function bindRuntimeModuleUpload(
  root: ParentNode,
  upload: (files: File[]) => void | Promise<void>,
): void {
  const form = root.querySelector<HTMLFormElement>("[data-runtime-upload]");
  if (!form) return;
  let incoming: Promise<{ file: File; path: string }[]> = Promise.resolve([]);
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  form.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const read = readDataTransfer(event.dataTransfer);
    incoming = read;
    void read.then((files) => {
      if (incoming !== read) return;
      const count = files.map((item) => item.file).filter(isRuntimeModuleFile).length;
      setRuntimeUploadStatus(
        form,
        count ? `${count} file${count === 1 ? "" : "s"} ready.` : "No .js or .mjs files in that drop.",
      );
    });
  });
  form.addEventListener("change", () => {
    const input = form.querySelector<HTMLInputElement>('input[name="file"]');
    const count = input?.files?.length ?? 0;
    if (!count) {
      setRuntimeUploadStatus(form, "");
      return;
    }
    const valid = [...(input?.files ?? [])].filter(isRuntimeModuleFile).length;
    setRuntimeUploadStatus(
      form,
      valid ? `${valid} file${valid === 1 ? "" : "s"} selected.` : "Choose .js or .mjs files.",
    );
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = incoming;
    incoming = Promise.resolve([]);
    void read.then(async (dropped) => {
      const input = form.querySelector<HTMLInputElement>('input[name="file"]');
      const fromInput = input?.files ? [...input.files] : [];
      const files = dropped.length
        ? dropped.map((item) => item.file).filter(isRuntimeModuleFile)
        : fromInput.filter(isRuntimeModuleFile);
      if (!files.length) {
        setRuntimeUploadStatus(form, "Choose at least one .js or .mjs file.");
        return;
      }
      setRuntimeUploadStatus(form, "");
      if (input) input.value = "";
      await upload(files);
    });
  });
}

export function renderRuntimeModuleDetail(mod: RuntimeModuleAsset, raw: string): string {
  const dialogTitle = escapeHtml(mod.title?.trim() || mod.id);
  const titleValue = escapeHtml(mod.title?.trim() ?? "");
  return `<div class="runtime-module-editor">
    <form id="runtime-module-form" data-runtime-raw>
      <p><label for="runtime-module-title">Title</label>
        <input id="runtime-module-title" name="title" class="w3-input w3-border" value="${titleValue}" autocomplete="off" />
        <span class="w3-small w3-text-grey">Shown in lists and bindings. Leave blank to use the id (<code>${escapeHtml(mod.id)}</code>).</span></p>
      <p class="w3-small runtime-module-url"><code>${escapeHtml(mod.url)}</code></p>
      <h3 class="runtime-module-dialog-title">${dialogTitle}</h3>
      <p class="runtime-module-tools"><button type="button" class="w3-button w3-small w3-white" data-runtime-maximize>Maximize</button></p>
      <p class="runtime-module-editor-area"><label for="runtime-module-raw-${escapeHtml(mod.id)}">Raw file</label><textarea id="runtime-module-raw-${escapeHtml(mod.id)}" name="text" class="w3-input w3-border editor-html" rows="24" spellcheck="false">${escapeHtml(raw)}</textarea></p>
      <p class="runtime-module-actions">
        <button type="button" class="w3-button w3-white runtime-module-normalize" data-runtime-normalize>Normalize</button>
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
  let codeEditor: MaximizedCodeEditorHandle | null = null;
  const dialogs = new WeakMap<HTMLElement, DialogController>();

  const restore = () => {
    codeEditor?.destroy();
    codeEditor = null;
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
    if (textarea) codeEditor = mountMaximizedCodeEditor(textarea, "javascript");
    dialogs.set(
      editor,
      activateDialog(overlay, {
        onCancel: restore,
        returnFocus: maximize,
        initialFocus: ".maximized-code-editor .cm-content",
      }),
    );
    codeEditor?.focus();
  });
  normalize?.addEventListener("click", restore);
}
