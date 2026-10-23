import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { emptyRootRecordDraft, fieldById, formatRecordDisplayName } from "@r-a-i-t-h/tessera-model";
import {
  appendDatasetRecord,
  datasetRootRecords,
  deleteDatasetRecord,
  getDataset,
  getLibrary,
  listDatasets,
  patchDatasetRecords,
  saveDatasetRecord,
  type PublicUser,
} from "../api.js";
import { editorChrome, type EditorSection } from "../chrome.js";
import { activateDialog } from "../dialog.js";
import { escapeHtml } from "../dom.js";
import { hasOpenModal } from "../escape-key.js";
import { mountHtmlEditor, readHtmlEditor, renderHtmlEditor } from "../html-editor.js";
import { openLibraryPicker } from "../library-picker.js";
import type { PickedAsset } from "../forms/picker.js";
import {
  cellDisplay,
  filterRecords,
  gridColumns,
  sortRecords,
  type DisplayContext,
  type GridFilters,
  type GridSort,
} from "./grid.js";
import { datasetNavItems } from "./nav.js";
import { openRecordPicker } from "./record-picker.js";
import { newListItemForField, readRecordForm, renderRecordForm } from "./record-form.js";

type BindChrome = (root: HTMLElement) => void;

let datasetViewShortcuts: AbortController | undefined;

function stopDatasetViewShortcuts(): void {
  datasetViewShortcuts?.abort();
  datasetViewShortcuts = undefined;
}

function startDatasetViewShortcuts(onAddRecord: () => void): void {
  stopDatasetViewShortcuts();
  datasetViewShortcuts = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.code !== "KeyN" || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
      if (hasOpenModal()) return;
      if (!document.querySelector(".editor-dataset-page")) return;
      event.preventDefault();
      onAddRecord();
    },
    { signal: datasetViewShortcuts.signal },
  );
}

export async function mountData(
  root: HTMLElement,
  user: PublicUser,
  datasetId: string | undefined,
  bindChrome: BindChrome,
): Promise<void> {
  if (!datasetId) {
    stopDatasetViewShortcuts();
    await mountDataList(root, user, bindChrome);
    return;
  }
  await mountDatasetGrid(root, user, datasetId, bindChrome);
}

async function mountDataList(root: HTMLElement, user: PublicUser, bindChrome: BindChrome): Promise<void> {
  const { datasets } = await listDatasets();
  const rows = datasets
    .map(
      (d) =>
        `<tr><td><a href="#/data/${encodeURIComponent(d.id)}">${escapeHtml(d.title.trim() || d.id)}</a></td><td>${escapeHtml(d.id)}</td><td>${d.recordCount}</td><td>${d.invalidCount || ""}</td></tr>`,
    )
    .join("");
  root.innerHTML = editorChrome(
    user,
    `<h1 class="w3-large">Data</h1>
     <table class="w3-table w3-bordered w3-striped"><thead><tr><th>Title</th><th>Id</th><th>Records</th><th>Invalid</th></tr></thead><tbody>${rows || "<tr><td colspan=\"4\" class=\"w3-text-grey\">No datasets yet.</td></tr>"}</tbody></table>`,
    true,
    "data" as EditorSection,
    { datasets: datasetNavItems(datasets) },
  );
  bindChrome(root);
}

async function mountDatasetGrid(
  root: HTMLElement,
  user: PublicUser,
  datasetId: string,
  bindChrome: BindChrome,
): Promise<void> {
  const [{ file }, library, { datasets: datasetSummaries }] = await Promise.all([
    getDataset(datasetId),
    getLibrary(),
    listDatasets(),
  ]);
  const navDatasets = datasetNavItems(datasetSummaries);
  const refCache = new Map<string, Map<number, string>>();
  const ctx: DisplayContext = {
    assetName: (id) => library.assets.find((a) => a.id === id)?.name ?? id,
    refTitle: (ds, uid) => refCache.get(ds)?.get(uid) ?? String(uid),
  };

  let gridMode: "view" | "edit" = "view";
  let sort: GridSort | undefined;
  let filters: GridFilters = {};
  let fileState = file;

  const recordDisplayContext = (): Parameters<typeof formatRecordDisplayName>[3] => ({
    refLabel: (ds, uid) => refCache.get(ds)?.get(uid) ?? String(uid),
    assetLabel: (id) => ctx.assetName(id),
  });

  const recordLabel = (record: DatasetRootRecord) =>
    formatRecordDisplayName(
      record,
      fileState.view.displayName ?? "",
      fileState.schema.fields,
      recordDisplayContext(),
    );

  const loadRefTitles = async (ds: string) => {
    if (refCache.has(ds)) return;
    try {
      const { records } = await datasetRootRecords(ds);
      refCache.set(ds, new Map(records.map((r) => [r.uid, r.displayName])));
    } catch {
      refCache.set(ds, new Map());
    }
  };

  for (const field of fileState.schema.fields) {
    if (field.kind === "ref" && field.dataset) await loadRefTitles(field.dataset);
  }

  const paint = () => {
    const columns = gridColumns(fileState.view.columns, fileState.schema.fields);
    const sorted = sortRecords(fileState.records, columns, sort, ctx);
    const visible = filterRecords(sorted, columns, filters, ctx);
    const gridEmpty = columns.length === 0;
    const header = columns
      .map((col) => {
        const id = col.kind === "system" ? col.id : col.id;
        const arrow = sort?.column === id ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
        return `<th><button type="button" class="w3-button w3-white w3-small" data-sort-col="${escapeHtml(id)}">${escapeHtml(id)}${arrow}</button></th>`;
      })
      .join("");
    const filterRow = columns
      .map((col) => {
        const id = col.kind === "system" ? col.id : col.id;
        const val = filters[id] ?? "";
        if (col.kind === "field" && col.field.kind === "boolean") {
          return `<td><select class="w3-select w3-small" data-filter-col="${escapeHtml(id)}">
            <option value="">Any</option><option value="yes"${val === "yes" ? " selected" : ""}>Yes</option><option value="no"${val === "no" ? " selected" : ""}>No</option>
          </select></td>`;
        }
        return `<td><input class="w3-input w3-small" data-filter-col="${escapeHtml(id)}" value="${escapeHtml(val)}" placeholder="Filter" /></td>`;
      })
      .join("");
    const body = gridEmpty
      ? visible
          .map(
            (record) =>
              `<tr data-record-row="${record.uid}"><td><button type="button" class="w3-button w3-white w3-small" data-open-record="${record.uid}">${escapeHtml(recordLabel(record))}</button></td></tr>`,
          )
          .join("")
      : visible
          .map((record) => {
            const cells = columns
              .map((col) => {
                if (gridMode === "edit") {
                  if (col.kind === "system") {
                    return `<td>${escapeHtml(cellDisplay(record, col, ctx))}</td>`;
                  }
                  return `<td>${renderEditCell(record, col.field, col.id)}</td>`;
                }
                return `<td class="editor-dataset-cell" data-open-record="${record.uid}">${escapeHtml(truncate(cellDisplay(record, col, ctx), 80))}</td>`;
              })
              .join("");
            return `<tr data-record-row="${record.uid}">${cells}</tr>`;
          })
          .join("");
    const headerRow = gridEmpty ? "<th>Record</th>" : header;
    const filterRowHtml = gridEmpty ? "<td></td>" : filterRow;

    const hasActiveFilters = Object.values(filters).some((v) => v.trim());
    const clearFiltersLink = hasActiveFilters
      ? `<p class="editor-dataset-grid-meta"><button type="button" class="editor-dataset-clear-filters" data-dataset-clear-filters>Clear filters</button></p>`
      : "";

    root.innerHTML = editorChrome(
      user,
      `<div class="editor-dataset-page" data-dataset-id="${escapeHtml(datasetId)}">
        <p><a href="#/data">Data</a> / <strong>${escapeHtml(fileState.title)}</strong>
          <span class="w3-text-grey w3-small"> · <a href="#/records/datasets/${encodeURIComponent(datasetId)}">Dataset setup</a></span></p>
        <p class="editor-toolbar-row">
          <button type="button" class="w3-button w3-theme" data-dataset-add>Add record</button>
          ${gridMode === "view" ? `<button type="button" class="w3-button w3-white" data-dataset-edit-mode>Edit grid</button>` : `<button type="button" class="w3-button w3-theme" data-dataset-save-grid>Save grid</button><button type="button" class="w3-button w3-white" data-dataset-cancel-grid>Cancel</button>`}
        </p>
        ${clearFiltersLink}<div class="editor-dataset-grid-wrap"><table class="w3-table w3-bordered w3-small editor-dataset-grid"><thead><tr>${headerRow}</tr><tr>${filterRowHtml}</tr></thead><tbody>${body}</tbody></table></div>
      </div>`,
      true,
      "data" as EditorSection,
      { datasets: navDatasets, activeDataset: datasetId },
    );
    bindChrome(root);
    bindGridEvents(root);
  };

  function renderEditCell(record: DatasetRootRecord, field: DatasetField, colId: string): string {
    const v = record[field.id];
    if (field.kind === "boolean") {
      return `<input type="checkbox" data-grid-edit="${record.uid}" data-grid-field="${field.id}"${v === true ? " checked" : ""} />`;
    }
    if (field.kind === "enum") {
      const opts = (field.options ?? [])
        .map((o) => `<option value="${escapeHtml(o.value)}"${v === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
        .join("");
      return `<select class="w3-select w3-small" data-grid-edit="${record.uid}" data-grid-field="${field.id}">${opts}</select>`;
    }
    if (field.kind === "html") {
      return `<button type="button" class="w3-button w3-tiny" data-grid-html="${record.uid}" data-grid-field="${field.id}">Edit HTML</button>`;
    }
    if (field.kind === "asset" || field.kind === "ref") {
      return `<button type="button" class="w3-button w3-tiny" data-grid-picker="${record.uid}" data-grid-field="${field.id}">Choose</button>`;
    }
    const type = field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text";
    return `<input class="w3-input w3-small" type="${type}" data-grid-edit="${record.uid}" data-grid-field="${field.id}" value="${escapeHtml(v === undefined || v === null ? "" : String(v))}" />`;
  }

  function bindGridEvents(host: HTMLElement): void {
    host.querySelector("[data-dataset-clear-filters]")?.addEventListener("click", () => {
      filters = {};
      paint();
    });
    host.querySelector("[data-dataset-add]")?.addEventListener("click", () => void openRecordDialog(undefined));
    host.querySelector("[data-dataset-edit-mode]")?.addEventListener("click", () => {
      gridMode = "edit";
      paint();
    });
    host.querySelector("[data-dataset-cancel-grid]")?.addEventListener("click", () => {
      gridMode = "view";
      paint();
    });
    host.querySelector("[data-dataset-save-grid]")?.addEventListener("click", () => void saveGridEdits());
    host.querySelectorAll("[data-sort-col]").forEach((el) => {
      el.addEventListener("click", () => {
        const col = (el as HTMLElement).dataset.sortCol!;
        if (sort?.column === col) sort = { column: col, dir: sort.dir === "asc" ? "desc" : "asc" };
        else sort = { column: col, dir: "asc" };
        paint();
      });
    });
    host.querySelectorAll("[data-filter-col]").forEach((el) => {
      el.addEventListener("input", () => {
        const col = (el as HTMLElement).dataset.filterCol!;
        const selection =
          el instanceof HTMLInputElement && el.selectionStart !== null && el.selectionEnd !== null
            ? { start: el.selectionStart, end: el.selectionEnd }
            : undefined;
        filters[col] = el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el.value : "";
        paint();
        const next = host.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[data-filter-col="${CSS.escape(col)}"]`,
        );
        if (next instanceof HTMLInputElement) {
          next.focus();
          if (selection) next.setSelectionRange(selection.start, selection.end);
        } else if (next instanceof HTMLSelectElement) {
          next.focus();
        }
      });
    });
    host.querySelectorAll("[data-open-record]").forEach((el) => {
      el.addEventListener("click", (event) => {
        if (gridMode === "edit") return;
        event.preventDefault();
        const uid = Number((el as HTMLElement).dataset.openRecord);
        const record = fileState.records.find((r) => r.uid === uid);
        if (record) void openRecordDialog(record);
      });
    });
    host.querySelectorAll("[data-grid-html]").forEach((el) => {
      el.addEventListener("click", () => {
        const uid = Number((el as HTMLElement).dataset.gridHtml);
        const fieldId = (el as HTMLElement).dataset.gridField!;
        const record = fileState.records.find((r) => r.uid === uid);
        const field = fieldById(fileState.schema.fields, fieldId);
        if (!record || !field) return;
        void openHtmlPopover(String(record[fieldId] ?? "")).then((html) => {
          if (html === undefined) return;
          record[fieldId] = html;
        });
      });
    });
    host.querySelectorAll("[data-grid-picker]").forEach((el) => {
      el.addEventListener("click", () => {
        const uid = Number((el as HTMLElement).dataset.gridPicker);
        const fieldId = (el as HTMLElement).dataset.gridField!;
        const record = fileState.records.find((r) => r.uid === uid);
        const field = fieldById(fileState.schema.fields, fieldId);
        if (!record || !field) return;
        void pickForField(field, record.uid).then((value) => {
          if (value === undefined) return;
          record[fieldId] = value;
        });
      });
    });
  }

  async function pickForField(field: DatasetField, excludeUid: number): Promise<unknown> {
    if (field.kind === "ref") {
      const uid = await openRecordPicker(field.dataset ?? "", { excludeUid });
      return uid;
    }
    if (field.kind === "asset") {
      const picked = await openLibraryPicker("image");
      if (!picked || ("kind" in picked && picked.kind === "folder")) return undefined;
      const asset = picked as PickedAsset;
      return field.many ? [asset.id] : asset.id;
    }
    return undefined;
  }

  async function openHtmlPopover(initial: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const host = document.createElement("div");
      host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card" role="dialog" aria-modal="true" tabindex="-1">
        ${renderHtmlEditor(initial, "html-pop")}
        <p><button type="button" class="w3-button w3-theme" data-html-save>Done</button>
        <button type="button" class="w3-button w3-white" data-html-cancel>Cancel</button></p>
      </div></div>`;
      mountHtmlEditor(host);
      document.body.appendChild(host);
      const dialog = activateDialog(host, {
        onCancel: () => {
          host.remove();
          dialog.destroy();
          resolve(undefined);
        },
        closeOnBackdrop: true,
      });
      host.querySelector("[data-html-save]")?.addEventListener("click", () => {
        const editor = host.querySelector<HTMLElement>("[data-html-editor]");
        const html = editor ? readHtmlEditor(editor) : "";
        host.remove();
        dialog.destroy();
        resolve(html);
      });
      host.querySelector("[data-html-cancel]")?.addEventListener("click", () => {
        host.remove();
        dialog.destroy();
        resolve(undefined);
      });
    });
  }

  async function saveGridEdits(): Promise<void> {
    const page = root.querySelector(".editor-dataset-page");
    if (!page) return;
    const items: { uid: number; record: Record<string, unknown> }[] = [];
    for (const record of fileState.records) {
      const next: Record<string, unknown> = { ...record };
      page.querySelectorAll<HTMLElement>(`[data-grid-edit="${record.uid}"]`).forEach((el) => {
        const field = el.dataset.gridField!;
        if (el instanceof HTMLInputElement && el.type === "checkbox") next[field] = el.checked;
        else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
          const f = fieldById(fileState.schema.fields, field);
          if (f?.kind === "number") next[field] = el.value === "" ? undefined : Number(el.value);
          else if (el.value.trim()) next[field] = el.value.trim();
          else delete next[field];
        }
      });
      items.push({ uid: record.uid, record: next });
    }
    const res = await patchDatasetRecords(datasetId, items);
    fileState = res.file;
    gridMode = "view";
    paint();
  }

  async function openRecordDialog(record: DatasetRootRecord | undefined): Promise<void> {
    const draft = record ?? (emptyRootRecordDraft(fileState.schema) as Record<string, unknown>);
    const host = document.createElement("div");
    let paintDialog: () => void;
    paintDialog = () => {
      host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card editor-dataset-record-dialog" role="dialog" aria-modal="true" tabindex="-1">
        <h2 class="w3-large">${record ? "Edit record" : "New record"}</h2>
        <form id="dataset-record-form">${renderRecordForm(draft, fileState.schema.fields, { isRoot: true })}</form>
        <p><button type="submit" form="dataset-record-form" class="w3-button w3-theme">Save</button>
        ${record ? `<button type="button" class="w3-button w3-white w3-border w3-border-red" data-record-delete>Delete</button>` : ""}
        <button type="button" class="w3-button w3-white" data-record-cancel>Cancel</button></p>
      </div></div>`;
      host.querySelectorAll<HTMLElement>("[data-html-editor]").forEach((el) => mountHtmlEditor(el));
      bindRecordForm(host, draft, paintDialog);
    };
    let dialog: ReturnType<typeof activateDialog> | undefined;
    const close = () => {
      host.remove();
      dialog?.destroy();
    };
    paintDialog();
    document.body.appendChild(host);
    dialog = activateDialog(host, { onCancel: close, closeOnBackdrop: false });

    host.querySelector("#dataset-record-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const next = readRecordForm(form, fileState.schema.fields, draft);
      const save = record
        ? saveDatasetRecord(datasetId, record.uid, next)
        : appendDatasetRecord(datasetId, next);
      void save.then((res) => {
        fileState = res.file;
        close();
        paint();
      });
    });
    host.querySelector("[data-record-cancel]")?.addEventListener("click", close);
    host.querySelector("[data-record-delete]")?.addEventListener("click", () => {
      if (!record || !window.confirm("Delete this record?")) return;
      void deleteDatasetRecord(datasetId, record.uid).then((res) => {
        fileState = res.file;
        close();
        paint();
      });
    });
  }

  function bindRecordForm(host: HTMLElement, draft: Record<string, unknown>, repaint: () => void): void {
    host.querySelectorAll("[data-picker-choose]").forEach((el) => {
      el.addEventListener("click", () => {
        const row = el.closest<HTMLElement>("[data-picker-field]");
        const name = row?.dataset.pickerField;
        const kind = row?.dataset.pickerKind;
        if (!name || !kind) return;
        const field = fieldById(fileState.schema.fields, name.split(".").pop() ?? name);
        if (!field) return;
        void pickForField(field, Number(draft.uid ?? 0)).then((value) => {
          if (value === undefined) return;
          const hidden = row?.querySelector<HTMLInputElement>('input[type="hidden"]');
          if (hidden) hidden.value = field.many ? JSON.stringify(value) : String(value);
          const display = row?.querySelector("[data-picker-display]");
          if (display) display.textContent = String(value);
          setPath(draft, name, value);
        });
      });
    });
    host.querySelectorAll("[data-list-add]").forEach((el) => {
      el.addEventListener("click", () => {
        const path = (el as HTMLElement).dataset.listAdd!;
        const field = fieldById(fileState.schema.fields, path);
        if (!field || field.kind !== "list") return;
        const list = (getPath(draft, path) as unknown[]) ?? [];
        list.push(newListItemForField(field));
        setPath(draft, path, list);
        repaint();
      });
    });
  }

  startDatasetViewShortcuts(() => void openRecordDialog(undefined));
  paint();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (!next || typeof next !== "object") {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
