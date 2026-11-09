import type { DatasetField, DatasetFile } from "@r-a-i-t-h/tessera-model";
import { summarizeSchemaAdaptation } from "@r-a-i-t-h/tessera-model";
import {
  createDataset,
  deleteDataset,
  duplicateDataset,
  getDataset,
  listDatasets,
  updateDatasetSchema,
  updateDatasetTitle,
  updateDatasetView,
  type DatasetSummary,
  type PublicUser,
} from "../api.js";
import { pageIdError, suggestDuplicateId } from "../forms/page.js";
import { editorChrome } from "../chrome.js";
import { mergeEditorNav } from "../sidebar-nav.js";
import { buildDatasetEntityItems } from "../entity-opener-items.js";
import { bindEntityOpener, entityOpenerHtml } from "../entity-opener.js";
import { confirmDialog } from "../confirm-dialog.js";
import { escapeHtml, errorPanel, formErrorPanel, showFormError } from "../dom.js";
import { parseRoute } from "../router.js";
import {
  adaptationSummaryHtml,
  applySchemaAction,
  applySchemaActionForRow,
  focusSchemaFieldId,
  readSchemaForm,
  renderSchemaForm,
  schemaDraftFromFields,
  validateSchemaDraft,
  type SchemaDraft,
} from "./schema-form.js";

type BindChrome = (root: HTMLElement) => void;

type DatasetSetupTab = "dataset" | "schema" | "raw";

/** Bumped on each mount so late API responses cannot repaint another route or dataset. */
let datasetSetupMountSeq = 0;

function isActiveDatasetSetupMount(mountId: number, datasetId: string): boolean {
  if (mountId !== datasetSetupMountSeq) return false;
  const route = parseRoute(window.location.hash);
  return route.page === "records" && route.setupDataset === datasetId;
}

function datasetSetupTab(tab: DatasetSetupTab, label: string, active: DatasetSetupTab): string {
  const on = active === tab;
  return `<button type="button" class="editor-tab${on ? " is-active" : ""}" role="tab" data-dataset-tab="${tab}" aria-selected="${on}" tabindex="${on ? "0" : "-1"}">${escapeHtml(label)}</button>`;
}

function datasetRawJson(file: DatasetFile): string {
  return JSON.stringify(file, null, 2);
}

function datasetDuplicateToolsHtml(suggestedId: string): string {
  return `<form id="dataset-tools" class="w3-card w3-white w3-padding editor-card">
    <p class="editor-rename-row">
      <label for="dataset-duplicate-id">Duplicate as</label>
      <input id="dataset-duplicate-id" name="duplicate-id" class="w3-input w3-border" value="${escapeHtml(suggestedId)}" autocomplete="off" spellcheck="false" />
      <button type="button" class="w3-button w3-white" data-action="duplicate-dataset">Duplicate</button>
    </p>
    ${formErrorPanel()}
  </form>`;
}

function datasetDuplicateIdError(id: string, existingIds: readonly string[]): string | undefined {
  return pageIdError(id, existingIds)?.replace("A page with id", "A dataset with id");
}

function summarizePreview(nextFields: DatasetField[], prevFields: DatasetField[]) {
  return summarizeSchemaAdaptation({ fields: prevFields }, { fields: nextFields });
}

export function datasetsSetupSection(datasets: DatasetSummary[]): string {
  const rows = datasets
    .map(
      (d) =>
        `<tr>
          <td>${escapeHtml(d.id)}</td>
          <td><a href="#/records/datasets/${encodeURIComponent(d.id)}"><strong>${escapeHtml(d.title.trim() || d.id)}</strong></a></td>
          <td>${d.recordCount}</td>
          <td><a class="w3-button w3-small w3-white" href="#/data/${encodeURIComponent(d.id)}">Edit data</a></td>
        </tr>`,
    )
    .join("");
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-dataset">New dataset</button></p>
    <form id="new-dataset-form" class="editor-new-page" hidden>
      <p>
        <label for="new-dataset-id">Id</label>
        <input id="new-dataset-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p>
        <label for="new-dataset-title">Title</label>
        <input id="new-dataset-title" name="title" class="w3-input w3-border w3-margin-top" />
      </p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create dataset</button></p>
    </form>
    <table class="w3-table w3-bordered w3-striped">
      <thead><tr><th>Id</th><th>Title</th><th>Records</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="w3-text-grey">No datasets yet.</td></tr>`}</tbody>
    </table>`;
}

export function bindDatasetsSetup(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>("#new-dataset-form");
  root.querySelector("[data-action=new-dataset]")?.addEventListener("click", () => {
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-dataset-id")?.focus();
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form) return;
    const id = String(new FormData(form).get("id") ?? "").trim();
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!id) {
      showFormError(form, "Id is required.");
      return;
    }
    const button = form.querySelector("button[type=submit]");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    void createDataset(id, title)
      .then(() => {
        window.location.hash = `#/records/datasets/${encodeURIComponent(id)}`;
      })
      .catch((err) => {
        if (button instanceof HTMLButtonElement) button.disabled = false;
        showFormError(form, err instanceof Error ? err.message : "Could not create that dataset.");
      });
  });
}

export async function mountDatasetSetup(
  root: HTMLElement,
  user: PublicUser,
  datasetId: string,
  bindChrome: BindChrome,
): Promise<void> {
  const mountId = ++datasetSetupMountSeq;
  const [{ file }, { datasets: allDatasets }] = await Promise.all([getDataset(datasetId), listDatasets()]);
  if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
  let fileState = file;
  let activeTab: DatasetSetupTab = "dataset";
  let draft: SchemaDraft = schemaDraftFromFields(fileState.schema.fields, fileState.view.columns);
  let panelError = "";
  let panelNotice = "";

  const schemaFormOptions = () => ({
    datasetOptions: allDatasets.map((d) => ({ id: d.id, title: d.title })),
    excludeDatasetId: datasetId,
  });

  const paint = () => {
    if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
    const title = fileState.title.trim() || datasetId;
    const entityItems = buildDatasetEntityItems(allDatasets, datasetId, "setup");
    const schemaTabBody =
      activeTab === "schema"
        ? `<div id="schema-root">${renderSchemaForm(draft, schemaFormOptions())}</div>`
        : "";
    const panelStatus =
      panelNotice || panelError
        ? activeTab === "schema" || activeTab === "dataset"
          ? `${panelNotice ? `<p class="w3-text-green w3-small">${escapeHtml(panelNotice)}</p>` : ""}${panelError ? errorPanel(panelError) : ""}`
          : ""
        : "";
    const datasetTabBody =
      activeTab === "dataset"
        ? `<div class="editor-dataset-settings-body">
            <p class="editor-dataset-settings-row">
              <label>Dataset id</label>
              <span class="editor-dataset-settings-static">${escapeHtml(datasetId)}</span>
            </p>
            <p class="editor-dataset-settings-row editor-dataset-settings-title-row">
              <label for="dataset-title">Title</label>
              <input id="dataset-title" class="w3-input w3-border" type="text" data-dataset-title value="${escapeHtml(fileState.title)}" spellcheck="false" />
            </p>
            <p class="editor-dataset-settings-row">
              <label for="dataset-display-name">Display name</label>
              <input id="dataset-display-name" class="w3-input w3-border" type="text" data-dataset-display-name placeholder="{make} {model} {year}" value="${escapeHtml(fileState.view.displayName ?? "")}" spellcheck="false" />
            </p>
            <p class="w3-text-grey w3-small">Template for record labels in pickers and lists. Use field ids in braces.</p>
          </div>`
        : "";
    const rawTabBody =
      activeTab === "raw"
        ? `<p class="w3-text-grey editor-record-note"><code>datasets/${escapeHtml(datasetId)}.json</code></p>
          <textarea class="w3-input w3-border editor-html" rows="24" readonly spellcheck="false">${escapeHtml(datasetRawJson(fileState))}</textarea>
          <p class="w3-text-grey w3-small">Datasets are stored as JSON on disk. Edit schema and records through the other tabs or the data grid.</p>`
        : "";
    const tabBody = `${panelStatus}${datasetTabBody || schemaTabBody || rawTabBody}`;
    const saveDisabled = activeTab === "raw" ? " disabled" : "";
    const saveTitle =
      activeTab === "schema"
        ? "Save schema and column visibility (Ctrl+S)"
        : activeTab === "dataset"
          ? "Save (Ctrl+S)"
          : "Nothing to save on this tab";

    const duplicateSuggested = suggestDuplicateId(datasetId, allDatasets.map((d) => d.id));

    root.innerHTML = editorChrome(
      user,
      `<div class="editor-dataset-setup" data-dataset-id="${escapeHtml(datasetId)}">
        <div class="editor-toolbar">
          <div class="editor-toolbar-row">
            <a class="w3-button w3-white editor-back" href="#/records/datasets" aria-label="Back" title="Back (Escape)">←</a>
            ${entityOpenerHtml(title, datasetId, entityItems)}
            <p class="editor-actions">
              <a class="w3-button w3-white" href="#/data/${encodeURIComponent(datasetId)}">Edit data</a>
              <button type="button" class="w3-button w3-theme" data-dataset-save${saveDisabled} title="${escapeHtml(saveTitle)}">Save</button>
              <button type="button" class="w3-button w3-white w3-border w3-border-red" data-dataset-delete-ds>Delete dataset</button>
            </p>
          </div>
        </div>
        <div class="editor-tab-panel">
          <div class="editor-tab-strip">
            <div class="editor-tabs" role="tablist" aria-label="Dataset editor">
              ${datasetSetupTab("dataset", "Dataset", activeTab)}
              ${datasetSetupTab("schema", "Schema", activeTab)}
              ${datasetSetupTab("raw", "Raw file", activeTab)}
            </div>
          </div>
          <div class="editor-tab-body">
            <div class="w3-card w3-white w3-padding-large editor-card">${tabBody}</div>
          </div>
        </div>
        ${datasetDuplicateToolsHtml(duplicateSuggested)}
      </div>`,
      true,
      "records",
      mergeEditorNav({ recordsKind: "datasets" }),
    );
    bindChrome(root);
    bindEntityOpener(root);
    bindSetupEvents(root);
  };

  const schemaRoot = () => root.querySelector("#schema-root");

  const syncDraftFromDom = () => {
    const rootEl = schemaRoot();
    if (rootEl instanceof HTMLElement) draft = readSchemaForm(rootEl, draft);
  };

  const paintSchemaFields = () => {
    const rootEl = schemaRoot();
    if (rootEl) rootEl.innerHTML = renderSchemaForm(draft, schemaFormOptions());
  };

  const bindSetupEvents = (host: HTMLElement): void => {
    for (const button of host.querySelectorAll<HTMLButtonElement>("[data-dataset-tab]")) {
      button.addEventListener("click", () => {
        const next = button.dataset.datasetTab;
        if (next !== "dataset" && next !== "schema" && next !== "raw") return;
        if (next === activeTab) return;
        if (activeTab === "schema") syncDraftFromDom();
        panelError = "";
        panelNotice = "";
        activeTab = next;
        paint();
      });
    }
    const saveDatasetSettings = () => {
      const titleInput = host.querySelector<HTMLInputElement>("[data-dataset-title]");
      const displayInput = host.querySelector<HTMLInputElement>("[data-dataset-display-name]");
      const nextTitle = titleInput?.value.trim() ?? "";
      const nextDisplayName = displayInput?.value ?? "";
      if (!nextTitle) {
        panelError = "Title is required.";
        panelNotice = "";
        paint();
        return;
      }
      panelError = "";
      panelNotice = "";
      const titleChanged = nextTitle !== fileState.title.trim();
      const displayChanged = nextDisplayName !== (fileState.view.displayName ?? "");
      if (!titleChanged && !displayChanged) {
        panelNotice = "Nothing to save.";
        paint();
        return;
      }
      const run = async () => {
        let nextFile = fileState;
        if (titleChanged) {
          const res = await updateDatasetTitle(datasetId, nextTitle);
          nextFile = res.file;
        }
        if (displayChanged) {
          const res = await updateDatasetView(datasetId, {
            columns: nextFile.view.columns,
            displayName: nextDisplayName,
          });
          nextFile = res.file;
        }
        return nextFile;
      };
      void run()
        .then((nextFile) => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          fileState = nextFile;
          panelNotice = "Saved.";
          paint();
        })
        .catch((err) => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          panelError = err instanceof Error ? err.message : "Could not save dataset settings.";
          paint();
        });
    };
    host.querySelector("[data-dataset-delete-ds]")?.addEventListener("click", () => {
      void (async () => {
        const deleteButton = host.querySelector<HTMLButtonElement>("[data-dataset-delete-ds]");
        if (!(await confirmDialog({
          message: `Delete dataset ${datasetId}?`,
          returnFocus: deleteButton,
          destructive: true,
          confirmLabel: "Delete",
        }))) {
          return;
        }
        void deleteDataset(datasetId)
        .then(() => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          window.location.hash = "#/records/datasets";
        })
        .catch((err) => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          panelError = err instanceof Error ? err.message : "Could not delete dataset.";
          paint();
        });
      })();
    });

    const saveSchema = () => {
      if (activeTab !== "schema") return;
      const rootEl = schemaRoot();
      if (!(rootEl instanceof HTMLElement)) return;
      draft = readSchemaForm(rootEl, draft);
      const validationError = validateSchemaDraft(draft.fields);
      if (validationError) {
        panelError = validationError;
        panelNotice = "";
        paint();
        return;
      }
      const preview = summarizePreview(draft.fields, fileState.schema.fields);
      const summary = adaptationSummaryHtml(preview);
      void (async () => {
        if (!(await confirmDialog({
          message: `Apply schema changes?\n${summary.replace(/<[^>]+>/g, " ")}`,
        }))) {
          return;
        }
      panelError = "";
      panelNotice = "";
      const columns = draft.viewColumns;
      const run = async () => {
        const schemaRes = await updateDatasetSchema(datasetId, { fields: draft.fields });
        if (!isActiveDatasetSetupMount(mountId, datasetId)) return schemaRes.file;
        return (
          await updateDatasetView(datasetId, {
            columns,
            displayName: schemaRes.file.view.displayName ?? "",
          })
        ).file;
      };
      void run()
        .then((nextFile) => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          fileState = nextFile;
          draft = schemaDraftFromFields(fileState.schema.fields, fileState.view.columns);
          panelNotice = "Schema saved.";
          paint();
        })
        .catch((err) => {
          if (!isActiveDatasetSetupMount(mountId, datasetId)) return;
          panelError = err instanceof Error ? err.message : "Could not save schema.";
          paint();
        });
      })();
    };

    const saveCurrent = () => {
      if (activeTab === "raw") return;
      if (activeTab === "schema") saveSchema();
      else saveDatasetSettings();
    };

    host.querySelector("[data-dataset-save]")?.addEventListener("click", saveCurrent);

    host.querySelector<HTMLButtonElement>("[data-action=duplicate-dataset]")?.addEventListener("click", () => {
      const form = host.querySelector<HTMLFormElement>("#dataset-tools");
      const input = host.querySelector<HTMLInputElement>('[name="duplicate-id"]');
      const nextId = input?.value.trim() ?? "";
      const existingIds = allDatasets.map((d) => d.id);
      const problem = datasetDuplicateIdError(nextId, existingIds);
      if (problem) {
        if (form) showFormError(form, problem);
        return;
      }
      if (nextId === datasetId) {
        if (form) showFormError(form, "Choose a different id.");
        return;
      }
      void (async () => {
        const duplicateButton = host.querySelector<HTMLButtonElement>("[data-action=duplicate-dataset]");
        if (!(await confirmDialog({
          message: `Duplicate ${datasetId} as ${nextId}?`,
          returnFocus: duplicateButton,
        }))) {
          return;
        }
      if (form) showFormError(form, "");
      void duplicateDataset(datasetId, nextId)
        .then(() => {
          window.location.hash = `#/records/datasets/${encodeURIComponent(nextId)}`;
        })
        .catch((err) => {
          if (form) showFormError(form, err instanceof Error ? err.message : "Could not duplicate that dataset.");
        });
      })();
    });

    const addRootField = () => {
      syncDraftFromDom();
      draft = applySchemaAction(draft, "add", 0);
      paintSchemaFields();
      const rootEl = schemaRoot();
      if (rootEl instanceof HTMLElement) focusSchemaFieldId(rootEl, 0, draft.fields.length - 1);
    };

    host.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.code === "KeyS" && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          saveCurrent();
        }
      }
    });

    host.addEventListener("click", (event) => {
      const button = (event.target instanceof Element ? event.target : null)?.closest("button");
      if (!(button instanceof HTMLButtonElement) || !host.contains(button)) return;
      if (button.dataset.datasetTab) return;
      const rootEl = schemaRoot();
      if (!(rootEl instanceof HTMLElement)) return;
      if (button.dataset.schemaAction === "add") {
        event.preventDefault();
        addRootField();
        return;
      }
      const action = button.dataset.schemaRowAction;
      if (!action) return;
      const row = button.closest("li[data-schema-index]");
      if (!(row instanceof HTMLElement)) return;
      event.preventDefault();
      syncDraftFromDom();
      draft = applySchemaActionForRow(draft, row, action);
      paintSchemaFields();
    });

    host.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !host.contains(target)) return;
      if (target instanceof HTMLInputElement && target.matches("[data-view-col], [data-schema-visible]")) {
        syncDraftFromDom();
        return;
      }
      if (!(target instanceof HTMLSelectElement) || !target.matches("[data-schema-kind]")) return;
      syncDraftFromDom();
      paintSchemaFields();
      const depth = Number(target.dataset.depth ?? "0");
      const index = Number(target.dataset.schemaKind);
      const rootEl = schemaRoot();
      if (rootEl instanceof HTMLElement) focusSchemaFieldId(rootEl, depth, index);
    });
  };

  paint();
}
