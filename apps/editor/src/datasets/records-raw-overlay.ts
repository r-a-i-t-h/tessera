import type { DatasetFile, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { saveDatasetRecordsRaw } from "../api.js";
import { bindCodeWrap, codeWrapClass, codeWrapToggle } from "../code-wrap.js";
import { confirmDialog } from "../confirm-dialog.js";
import { activateDialog, type DialogController } from "../dialog.js";
import { escapeHtml, formErrorPanel, showFormError } from "../dom.js";
import { mountMaximizedCodeEditor, readFormText, type MaximizedCodeEditorHandle } from "../maximized-code-editor.js";

export type DatasetRecordsRawOverlayOptions = {
  datasetId: string;
  records: DatasetRootRecord[];
  returnFocus: HTMLElement;
  isActive: () => boolean;
  onSaved: (file: DatasetFile) => void;
};

export function openDatasetRecordsRawOverlay(options: DatasetRecordsRawOverlayOptions): void {
  const text = JSON.stringify(options.records, null, 2);
  const form = document.createElement("form");
  form.setAttribute("data-dataset-records-raw", "");
  form.className = "dataset-records-raw-editor";
  form.innerHTML = `<h3 class="dataset-records-raw-dialog-title">Raw JSON</h3>
    <p class="w3-small w3-text-grey"><code>${escapeHtml(options.datasetId)}</code> — root records only. Each object needs a <code>uid</code>.</p>
    <p class="dataset-records-raw-tools">${codeWrapToggle("dataset-records-raw-text")}</p>
    <p class="dataset-records-raw-area">
      <textarea id="dataset-records-raw-text" name="text" class="w3-input w3-border editor-raw${codeWrapClass()}" data-kind="json" rows="24" spellcheck="false">${escapeHtml(text)}</textarea>
    </p>
    ${formErrorPanel()}
    <p class="dataset-records-raw-actions editor-actions">
      <button type="submit" class="w3-button w3-theme">Save</button>
      <button type="button" class="w3-button w3-white dataset-records-raw-close">Close</button>
    </p>`;

  const overlay = document.createElement("div");
  overlay.className = "dataset-raw-overlay-host";
  document.body.appendChild(overlay);
  overlay.appendChild(form);
  form.setAttribute("role", "dialog");
  form.setAttribute("aria-modal", "true");
  form.tabIndex = -1;

  bindCodeWrap(form);

  let codeEditor: MaximizedCodeEditorHandle | null = null;
  let dialog: DialogController | null = null;
  const initialCount = options.records.length;
  const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="text"]');

  const remountEditor = () => {
    if (!textarea) return;
    codeEditor?.destroy();
    codeEditor = mountMaximizedCodeEditor(textarea, "json");
    codeEditor.focus();
  };

  const restore = () => {
    codeEditor?.destroy();
    codeEditor = null;
    dialog?.destroy();
    dialog = null;
    overlay.remove();
    options.returnFocus.focus();
  };

  if (textarea) codeEditor = mountMaximizedCodeEditor(textarea, "json");
  dialog = activateDialog(overlay, {
    onCancel: restore,
    returnFocus: options.returnFocus,
    initialFocus: ".maximized-code-editor .cm-content",
  });
  codeEditor?.focus();

  form.querySelector(".dataset-records-raw-close")?.addEventListener("click", restore);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const raw = readFormText(form);
      try {
        const parsed: unknown = JSON.parse(raw.trim());
        if (!Array.isArray(parsed)) {
          showFormError(form, "Records must be a JSON array.");
          remountEditor();
          return;
        }
        if (parsed.length !== initialCount) {
          if (
            !(await confirmDialog({
              message: `Replace ${initialCount} record${initialCount === 1 ? "" : "s"} with ${parsed.length}?`,
              returnFocus: form.querySelector<HTMLButtonElement>("[type=submit]"),
            }))
          ) {
            remountEditor();
            return;
          }
        }
      } catch {
        showFormError(form, "Raw JSON is not valid JSON.");
        remountEditor();
        return;
      }
      showFormError(form, "");
      try {
        const res = await saveDatasetRecordsRaw(options.datasetId, raw);
        if (!options.isActive()) {
          restore();
          return;
        }
        options.onSaved(res.file);
        restore();
      } catch (err) {
        showFormError(form, err instanceof Error ? err.message : "Could not save records.");
        remountEditor();
      }
    })();
  });
}
