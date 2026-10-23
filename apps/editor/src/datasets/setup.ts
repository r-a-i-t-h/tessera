import type { DatasetField } from "@r-a-i-t-h/tessera-model";
import { fieldById, summarizeSchemaAdaptation } from "@r-a-i-t-h/tessera-model";
import {
  createDataset,
  deleteDataset,
  getDataset,
  listDatasets,
  updateDatasetSchema,
  updateDatasetTitle,
  updateDatasetView,
  type DatasetSummary,
  type PublicUser,
} from "../api.js";
import { editorChrome } from "../chrome.js";
import { mergeEditorNav } from "../sidebar-nav.js";
import { escapeHtml, errorPanel, formErrorPanel, showFormError } from "../dom.js";
import { availableViewColumns } from "./grid.js";
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
  const [{ file }, { datasets: allDatasets }] = await Promise.all([getDataset(datasetId), listDatasets()]);
  let fileState = file;
  let columnsPanelOpen = false;
  let settingsPanelOpen = false;
  let draft: SchemaDraft = schemaDraftFromFields(fileState.schema.fields);
  let schemaError = "";

  const schemaFormOptions = () => ({
    datasetOptions: allDatasets.map((d) => ({ id: d.id, title: d.title })),
    excludeDatasetId: datasetId,
  });

  const paint = () => {
    const colOptions = availableViewColumns(fileState.schema.fields)
      .map((id) => {
        const on = fileState.view.columns.includes(id);
        const field = fieldById(fileState.schema.fields, id);
        const caption = field
          ? field.label.trim() || field.id
          : id === "uid"
            ? "UID"
            : id === "added"
              ? "Added"
              : id === "modified"
                ? "Modified"
                : id;
        return `<label class="editor-dataset-column-choice"><input type="checkbox" data-view-col="${escapeHtml(id)}"${on ? " checked" : ""} /><span>${escapeHtml(caption)}</span><span class="editor-dataset-column-id">${escapeHtml(id)}</span></label>`;
      })
      .join("");

    root.innerHTML = editorChrome(
      user,
      `<div class="editor-dataset-setup" data-dataset-id="${escapeHtml(datasetId)}">
        <p><a href="#/records/datasets">Datasets</a> / <strong>${escapeHtml(fileState.title.trim() || datasetId)}</strong></p>
        <p class="editor-toolbar-row">
          <a class="w3-button w3-theme" href="#/data/${encodeURIComponent(datasetId)}">Edit data</a>
        </p>
        <details class="editor-dataset-settings"${settingsPanelOpen ? " open" : ""}>
          <summary>Settings</summary>
          <div class="editor-dataset-settings-body">
            <p class="editor-dataset-settings-row">
              <label>Dataset id</label>
              <span class="editor-dataset-settings-static">${escapeHtml(datasetId)}</span>
            </p>
            <p class="editor-dataset-settings-row editor-dataset-settings-title-row">
              <label for="dataset-title">Title</label>
              <span class="editor-dataset-settings-title-control">
                <input id="dataset-title" class="w3-input w3-border" type="text" data-dataset-title value="${escapeHtml(fileState.title)}" spellcheck="false" />
                <button type="button" class="w3-button w3-small w3-white" data-dataset-rename>Rename</button>
              </span>
            </p>
            <p class="editor-dataset-settings-row">
              <label for="dataset-display-name">Display name</label>
              <input id="dataset-display-name" class="w3-input w3-border" type="text" data-dataset-display-name placeholder="{make} {model} {year}" value="${escapeHtml(fileState.view.displayName ?? "")}" spellcheck="false" />
            </p>
            <p class="editor-dataset-settings-actions">
              <button type="button" class="w3-button w3-white w3-border w3-border-red" data-dataset-delete-ds>Delete dataset</button>
            </p>
          </div>
        </details>
        <details class="editor-dataset-columns"${columnsPanelOpen ? " open" : ""}>
          <summary>Visible columns</summary>
          <p class="w3-text-grey w3-small">Columns shown in the dataset grid and published views.</p>
          <div class="editor-dataset-columns-grid">${colOptions}</div>
        </details>
        <section class="editor-dataset-schema-panel" aria-labelledby="dataset-schema-heading">
          <h2 id="dataset-schema-heading" class="w3-large">Schema</h2>
          <div id="schema-root">${renderSchemaForm(draft, schemaFormOptions())}</div>
          ${schemaError ? errorPanel(schemaError) : ""}
          <p><button type="button" class="w3-button w3-theme" data-schema-save>Save schema</button></p>
        </section>
      </div>`,
      true,
      "records",
      mergeEditorNav({ recordsKind: "datasets" }),
    );
    bindChrome(root);
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
    host.querySelector("details.editor-dataset-columns")?.addEventListener("toggle", (event) => {
      const details = event.target;
      if (details instanceof HTMLDetailsElement) columnsPanelOpen = details.open;
    });
    host.querySelector("details.editor-dataset-settings")?.addEventListener("toggle", (event) => {
      const details = event.target;
      if (details instanceof HTMLDetailsElement) settingsPanelOpen = details.open;
    });
    const persistView = (patch: { columns?: string[]; displayName?: string }) => {
      const columns = patch.columns ?? fileState.view.columns;
      const displayName = patch.displayName !== undefined ? patch.displayName : (fileState.view.displayName ?? "");
      fileState = { ...fileState, view: { columns, displayName } };
      paint();
      void updateDatasetView(datasetId, { columns, displayName })
        .then((res) => {
          fileState = res.file;
          draft = schemaDraftFromFields(fileState.schema.fields);
          paint();
        })
        .catch((err) => {
          schemaError = err instanceof Error ? err.message : "Could not save view settings.";
          paint();
        });
    };
    host.querySelector("[data-dataset-display-name]")?.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      persistView({ displayName: input.value });
    });
    const renameDataset = () => {
      const input = host.querySelector<HTMLInputElement>("[data-dataset-title]");
      if (!input) return;
      const title = input.value.trim();
      if (!title) return;
      void updateDatasetTitle(datasetId, title)
        .then((res) => {
          fileState = res.file;
          schemaError = "";
          paint();
        })
        .catch((err) => {
          schemaError = err instanceof Error ? err.message : "Could not rename dataset.";
          paint();
        });
    };
    host.querySelector("[data-dataset-rename]")?.addEventListener("click", renameDataset);
    host.querySelector<HTMLInputElement>("[data-dataset-title]")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        renameDataset();
      }
    });
    host.querySelector("[data-dataset-delete-ds]")?.addEventListener("click", () => {
      if (!window.confirm(`Delete dataset ${datasetId}?`)) return;
      void deleteDataset(datasetId)
        .then(() => {
          window.location.hash = "#/records/datasets";
        })
        .catch((err) => {
          schemaError = err instanceof Error ? err.message : "Could not delete dataset.";
          paint();
        });
    });
    host.querySelectorAll("[data-view-col]").forEach((el) => {
      el.addEventListener("change", () => {
        const cols = [...host.querySelectorAll<HTMLInputElement>("[data-view-col]:checked")].map(
          (input) => input.dataset.viewCol!,
        );
        persistView({ columns: cols });
      });
    });

    const saveSchema = () => {
      const rootEl = schemaRoot();
      if (!(rootEl instanceof HTMLElement)) return;
      draft = readSchemaForm(rootEl, draft);
      const validationError = validateSchemaDraft(draft.fields);
      if (validationError) {
        schemaError = validationError;
        paint();
        return;
      }
      const preview = summarizePreview(draft.fields, fileState.schema.fields);
      const summary = adaptationSummaryHtml(preview);
      if (!window.confirm(`Apply schema changes?\n${summary.replace(/<[^>]+>/g, " ")}`)) return;
      schemaError = "";
      void updateDatasetSchema(datasetId, { fields: draft.fields })
        .then((res) => {
          fileState = res.file;
          draft = schemaDraftFromFields(fileState.schema.fields);
          paint();
        })
        .catch((err) => {
          schemaError = err instanceof Error ? err.message : "Could not save schema.";
          paint();
        });
    };

    const addRootField = () => {
      syncDraftFromDom();
      draft = applySchemaAction(draft, "add", 0);
      paintSchemaFields();
      const rootEl = schemaRoot();
      if (rootEl instanceof HTMLElement) focusSchemaFieldId(rootEl, 0, draft.fields.length - 1);
    };

    host.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey) {
        if (!event.altKey && !event.shiftKey && event.code === "KeyA") {
          event.preventDefault();
          addRootField();
          return;
        }
        if (event.code === "KeyS" && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          saveSchema();
        }
      }
    });

    host.addEventListener("click", (event) => {
      const button = (event.target instanceof Element ? event.target : null)?.closest("button");
      if (!(button instanceof HTMLButtonElement) || !host.contains(button)) return;
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

    host.querySelector("[data-schema-save]")?.addEventListener("click", saveSchema);

    host.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.matches("[data-schema-kind]")) return;
      if (!host.contains(target)) return;
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
