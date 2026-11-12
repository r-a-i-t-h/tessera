import type { DatasetField, DatasetFile, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { emptyRootRecordDraft, fieldById, formatRecordDisplayName } from "@r-a-i-t-h/tessera-model";
import {
  appendDatasetRecord,
  ApiError,
  clearDatasetRecords,
  datasetRootRecords,
  deleteDatasetRecord,
  getDataset,
  getLibrary,
  listDatasets,
  listRecords,
  getRecord,
  patchDatasetRecords,
  saveDatasetRecord,
  type PublicUser,
} from "../api.js";
import { editorChrome, type EditorSection } from "../chrome.js";
import { buildDatasetEntityItems } from "../entity-opener-items.js";
import { bindEntityOpener, entityOpenerHtml } from "../entity-opener.js";
import { mergeEditorNav } from "../sidebar-nav.js";
import { confirmDialog } from "../confirm-dialog.js";
import { activateDialog } from "../dialog.js";
import { escapeHtml, formErrorPanel, showFormError } from "../dom.js";
import { editorRecordTable } from "../list-row.js";
import { openLibraryPicker } from "../library-picker.js";
import type { PickedAsset } from "../forms/picker.js";
import { assetDisplayHtml } from "./asset-display.js";
import {
  cellDisplay,
  cellDisplayMarkup,
  filterRecords,
  gridColumns,
  sortRecords,
  type DisplayContext,
  type GridFilters,
  type GridSort,
} from "./grid.js";
import { parseRoute } from "../router.js";
import { datasetNavItems } from "./nav.js";
import { openRecordPicker } from "./record-picker.js";
import { commitObjectListChange, compactRecordCollections, readRecordForm, renderRecordForm } from "./record-form.js";
import { bindRawHtmlField } from "../raw-html-field.js";
import { bindRichTextField, runRichTextCommand, type RichTextFieldOptions } from "../compose/rich-text-field.js";
import { buildPageTargetChoices, type PageTargetChoices } from "../forms/page-target.js";
import type { NavEntry } from "@r-a-i-t-h/tessera-model";
import { openPageTargetPicker as openPageTargetPickerDialog } from "../page-target-picker.js";
import { openDatasetRecordsRawOverlay } from "./records-raw-overlay.js";

type BindChrome = (root: HTMLElement) => void;

/** Bumped on each grid mount so late API responses cannot repaint another route or dataset. */
let datasetGridMountSeq = 0;

function isActiveDatasetGridMount(mountId: number, datasetId: string): boolean {
  if (mountId !== datasetGridMountSeq) return false;
  const route = parseRoute(window.location.hash);
  return route.page === "data" && route.datasetId === datasetId;
}

export async function mountData(
  root: HTMLElement,
  user: PublicUser,
  datasetId: string | undefined,
  bindChrome: BindChrome,
): Promise<void> {
  if (!datasetId) {
    await mountDataList(root, user, bindChrome);
    return;
  }
  await mountDatasetGrid(root, user, datasetId, bindChrome);
}

async function mountDataList(root: HTMLElement, user: PublicUser, bindChrome: BindChrome): Promise<void> {
  const { datasets } = await listDatasets();
  const rows = datasets.map((d) => ({
    href: `#/data/${encodeURIComponent(d.id)}`,
    cells: [
      `<td>${escapeHtml(d.id)}</td>`,
      `<td class="editor-record-table-primary">${escapeHtml(d.title.trim() || d.id)}</td>`,
      `<td>${d.recordCount}</td>`,
      `<td>${d.invalidCount || ""}</td>`,
    ],
  }));
  const table = editorRecordTable(rows, ["Id", "Title", "Records", "Invalid"], 4, "No datasets yet.");
  root.innerHTML = editorChrome(
    user,
    `<h1 class="w3-large">Data</h1>
     ${table}`,
    true,
    "data" as EditorSection,
    mergeEditorNav({ datasets: datasetNavItems(datasets) }),
  );
  bindChrome(root);
}

async function mountDatasetGrid(
  root: HTMLElement,
  user: PublicUser,
  datasetId: string,
  bindChrome: BindChrome,
): Promise<void> {
  const mountId = ++datasetGridMountSeq;
  const [{ file }, library, { datasets: datasetSummaries }, listing] = await Promise.all([
    getDataset(datasetId),
    getLibrary(),
    listDatasets(),
    listRecords(),
  ]);
  const pageTitles = new Map<string, string>();
  for (const row of listing.records) {
    if (row.kind === "content" && row.title) pageTitles.set(row.id, row.title);
  }
  let pageChoices: PageTargetChoices | undefined;
  try {
    const siteRow = listing.records.find((row) => row.kind === "site");
    const sitePayload = siteRow ? await getRecord("site", siteRow.id).catch(() => undefined) : undefined;
    const navPayload = await getRecord("nav", "nav").catch(() => undefined);
    const navEntries = Array.isArray(navPayload?.data) ? (navPayload.data as NavEntry[]) : [];
    const siteData =
      sitePayload?.data && typeof sitePayload.data === "object" && !Array.isArray(sitePayload.data)
        ? (sitePayload.data as Record<string, unknown>)
        : { id: "site", title: "Site", homePageId: "home" };
    pageChoices = buildPageTargetChoices(listing, siteData, navEntries);
  } catch {
    pageChoices = undefined;
  }
  if (!isActiveDatasetGridMount(mountId, datasetId)) return;
  const navDatasets = datasetNavItems(datasetSummaries);
  const refCache = new Map<string, Map<number, string>>();
  const ctx: DisplayContext = {
    assetName: (id) => library.assets.find((a) => a.id === id)?.name ?? id,
    refTitle: (ds, uid) => refCache.get(ds)?.get(uid) ?? String(uid),
    assetMarkup: (id) => assetDisplayHtml(id, library.assets),
  };

  let gridMode: "view" | "edit" = "view";
  let sort: GridSort | undefined;
  let filters: GridFilters = {};
  let fileState = file;

  const recordDisplayContext = (): Parameters<typeof formatRecordDisplayName>[3] => ({
    refLabel: (ds, uid) => refCache.get(ds)?.get(uid) ?? String(uid),
    assetLabel: (id) => ctx.assetName(id),
    assetUrl: (id) => library.assets.find((a) => a.id === id)?.url,
  });

  const formatAssetDisplay = (assetId: string) => assetDisplayHtml(assetId, library.assets);

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
  if (!isActiveDatasetGridMount(mountId, datasetId)) return;

  const paint = () => {
    if (!isActiveDatasetGridMount(mountId, datasetId)) return;
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
                const markup = cellDisplayMarkup(record, col, ctx);
                if (markup) {
                  return `<td class="editor-dataset-cell editor-dataset-cell--rich" data-open-record="${record.uid}">${markup}</td>`;
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

    const gridToolbarActions =
      gridMode === "view"
        ? `<button type="button" class="w3-button w3-white" data-dataset-edit-mode>Edit grid</button>`
        : `<button type="button" class="w3-button w3-theme" data-dataset-save-grid title="Save grid (Ctrl+S)">Save grid</button><button type="button" class="w3-button w3-white" data-dataset-cancel-grid>Cancel</button>`;

    const recordCount = fileState.records.length;
    const clearAllDisabled = recordCount === 0 || gridMode === "edit" ? " disabled" : "";
    const rawJsonDisabled = gridMode === "edit" ? " disabled" : "";

    root.innerHTML = editorChrome(
      user,
      `<div class="editor-toolbar">
        <div class="editor-toolbar-row">
          <a class="w3-button w3-white editor-back" href="#/data" aria-label="Back" title="Back (Escape)">←</a>
          ${entityOpenerHtml(fileState.title, datasetId, buildDatasetEntityItems(datasetSummaries, datasetId))}
          <p class="editor-actions">
            <button type="button" class="w3-button w3-theme" data-dataset-add>Add record</button>
            ${gridToolbarActions}
            <button type="button" class="w3-button w3-white" data-dataset-raw-json${rawJsonDisabled}>Raw JSON</button>
            <button type="button" class="w3-button w3-white w3-border w3-border-red" data-dataset-clear-all${clearAllDisabled}>Delete all records</button>
          </p>
        </div>
      </div>
      <div class="editor-dataset-page" data-dataset-id="${escapeHtml(datasetId)}">
        <p class="w3-text-grey w3-small"><a href="#/records/datasets/${encodeURIComponent(datasetId)}">Dataset setup</a></p>
        ${clearFiltersLink}<div class="editor-dataset-grid-wrap"><table class="w3-table w3-bordered w3-small editor-dataset-grid"><thead><tr>${headerRow}</tr><tr>${filterRowHtml}</tr></thead><tbody>${body}</tbody></table></div>
      </div>`,
      true,
      "data" as EditorSection,
      mergeEditorNav({ datasets: navDatasets, activeDataset: datasetId }),
    );
    bindChrome(root);
    bindEntityOpener(root);
    bindGridEvents(root);
  };

  function renderEditCell(record: DatasetRootRecord, field: DatasetField, colId: string): string {
    const v = record[field.id];
    if (field.kind === "object" || (field.many && field.kind !== "asset" && field.kind !== "ref")) {
      return escapeHtml(truncate(cellDisplay(record, { kind: "field", id: colId, field }, ctx), 80));
    }
    if (field.kind === "boolean") {
      return `<input type="checkbox" data-grid-edit="${record.uid}" data-grid-field="${field.id}"${v === true ? " checked" : ""} />`;
    }
    if (field.kind === "enum") {
      const opts = (field.options ?? [])
        .map((o) => `<option value="${escapeHtml(o.value)}"${v === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
        .join("");
      return `<select class="w3-select w3-small" data-grid-edit="${record.uid}" data-grid-field="${field.id}">${opts}</select>`;
    }
    if (field.kind === "asset") {
      const preview =
        !field.many && v !== undefined && v !== null && v !== ""
          ? `<span class="editor-dataset-asset-cell" data-asset-preview="${record.uid}" data-grid-field="${field.id}">${formatAssetDisplay(String(v))}</span>`
          : `<span class="editor-dataset-asset-cell" data-asset-preview="${record.uid}" data-grid-field="${field.id}"></span>`;
      return `${preview}<button type="button" class="w3-button w3-tiny" data-grid-picker="${record.uid}" data-grid-field="${field.id}">Choose</button>`;
    }
    if (field.kind === "ref") {
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
    host.querySelector("[data-dataset-raw-json]")?.addEventListener("click", (event) => {
      if (gridMode === "edit") return;
      const button = event.currentTarget;
      if (!(button instanceof HTMLButtonElement)) return;
      openDatasetRecordsRawOverlay({
        datasetId,
        records: fileState.records,
        returnFocus: button,
        isActive: () => isActiveDatasetGridMount(mountId, datasetId),
        onSaved: (next: DatasetFile) => {
          fileState = next;
          paint();
        },
      });
    });
    host.querySelector("[data-dataset-edit-mode]")?.addEventListener("click", () => {
      gridMode = "edit";
      paint();
    });
    host.querySelector("[data-dataset-cancel-grid]")?.addEventListener("click", () => {
      gridMode = "view";
      paint();
    });
    host.querySelector("[data-dataset-save-grid]")?.addEventListener("click", () => void saveGridEdits());
    host.querySelector("[data-dataset-clear-all]")?.addEventListener("click", () => {
      void (async () => {
        if (gridMode === "edit" || fileState.records.length === 0) return;
        const n = fileState.records.length;
        const label = fileState.title.trim() || datasetId;
        if (!(await confirmDialog({
          message: `Delete all ${n} record${n === 1 ? "" : "s"} from ${label}? This cannot be undone.`,
          destructive: true,
          confirmLabel: "Delete",
        }))) {
          return;
        }
        void clearDatasetRecords(datasetId)
        .then((res) => {
          if (!isActiveDatasetGridMount(mountId, datasetId)) return;
          fileState = res.file;
          filters = {};
          sort = undefined;
          gridMode = "view";
          paint();
        })
        .catch((err) => {
          window.alert(err instanceof Error ? err.message : "Could not delete records.");
        });
      })();
    });
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
          if (field.kind === "asset" && !field.many && typeof value === "string") {
            const preview = host.querySelector(
              `[data-asset-preview="${record.uid}"][data-grid-field="${fieldId}"]`,
            );
            if (preview) preview.innerHTML = formatAssetDisplay(value);
          }
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
    if (!isActiveDatasetGridMount(mountId, datasetId)) return;
    fileState = res.file;
    gridMode = "view";
    paint();
  }

  async function openRecordDialog(record: DatasetRootRecord | undefined): Promise<void> {
    const draft = (
      record ? structuredClone(record) : emptyRootRecordDraft(fileState.schema)
    ) as Record<string, unknown>;
    const host = document.createElement("div");
    let paintDialog: () => void;
    paintDialog = () => {
      host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card editor-dataset-record-dialog" role="dialog" aria-modal="true" tabindex="-1">
        <h2 class="w3-large">${record ? "Edit record" : "New record"}</h2>
        <form id="dataset-record-form">${formErrorPanel()}${renderRecordForm(draft, fileState.schema.fields, { isRoot: true, formatAssetDisplay })}<p class="editor-actions editor-form-actions"><button type="submit" class="w3-button w3-theme">Save</button>
        ${record ? `<button type="button" class="w3-button w3-white w3-border w3-border-red" data-record-delete>Delete</button>` : ""}
        <button type="button" class="w3-button w3-white" data-record-cancel>Cancel</button></p></form>
      </div></div>`;
      bindRecordForm(host, draft, paintDialog, pageTitles, pageChoices);
    };
    let dialog: ReturnType<typeof activateDialog> | undefined;
    const close = () => {
      host.remove();
      dialog?.destroy();
    };
    paintDialog();
    document.body.appendChild(host);
    dialog = activateDialog(host, { onCancel: close, closeOnBackdrop: false });

    host.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "dataset-record-form") return;
      event.preventDefault();
      const next = compactRecordCollections(
        readRecordForm(form, fileState.schema.fields, draft),
        fileState.schema.fields,
      );
      const save = record
        ? saveDatasetRecord(datasetId, record.uid, next)
        : appendDatasetRecord(datasetId, next);
      void save
        .then((res) => {
          if (!isActiveDatasetGridMount(mountId, datasetId)) {
            close();
            return;
          }
          fileState = res.file;
          close();
          paint();
        })
        .catch((err: unknown) => {
          const message = err instanceof ApiError ? err.message : "Could not save this record.";
          const current = host.querySelector("#dataset-record-form");
          if (current instanceof HTMLFormElement) showFormError(current, message);
        });
    });
    host.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !host.contains(target)) return;
      if (target.closest("[data-record-cancel]")) {
        close();
        return;
      }
      if (target.closest("[data-record-delete]")) {
        void (async () => {
          const deleteButton = host.querySelector<HTMLButtonElement>("[data-record-delete]");
          if (!record || !(await confirmDialog({
            message: "Delete this record?",
            returnFocus: deleteButton,
            destructive: true,
            confirmLabel: "Delete",
          }))) {
            return;
          }
          void deleteDatasetRecord(datasetId, record.uid).then((res) => {
            if (!isActiveDatasetGridMount(mountId, datasetId)) {
              close();
              return;
            }
            fileState = res.file;
            close();
            paint();
          });
        })();
      }
    });
  }

  function bindRecordForm(
    host: HTMLElement,
    draft: Record<string, unknown>,
    repaint: () => void,
    titles: Map<string, string>,
    choices?: PageTargetChoices,
  ): void {
    const form = host.querySelector<HTMLFormElement>("#dataset-record-form");
    if (form) {
      const richTextOptions: RichTextFieldOptions = {
        getContext: () => ({
          pageTitles: titles,
          pickPageLink: choices
            ? async (current, options) => {
                const picked = await openPageTargetPickerDialog(choices, current, options?.returnFocus);
                if (picked === undefined) return undefined;
                if (/^[a-z][a-z0-9+.-]*:/i.test(picked) || picked.startsWith("//")) {
                  return { kind: "url", href: picked };
                }
                return { kind: "page", id: picked, title: titles.get(picked) };
              }
            : undefined,
        }),
        onDirty: () => {},
      };
      bindRichTextField(form, richTextOptions);
      bindRawHtmlField(form, {
        openLibraryPicker,
        openPageTargetPicker: (choices, current, returnFocus) =>
          openPageTargetPickerDialog(choices, current, returnFocus),
        onDirty: () => {},
      });
      form.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const add = target?.closest<HTMLButtonElement>("[data-object-add], [data-many-add]");
        const fieldId = add?.dataset.objectAdd || add?.dataset.manyAdd;
        if (add && fieldId && form.contains(add)) {
          event.preventDefault();
          if (!commitObjectListChange(form, fileState.schema.fields, draft, { op: "add", fieldId })) return;
          const list = draft[fieldId];
          const index = Array.isArray(list) ? list.length - 1 : 0;
          repaint();
          queueMicrotask(() => focusCollectionRow(host, fieldId, index));
          return;
        }
        const remove = target?.closest<HTMLButtonElement>("[data-object-remove], [data-many-remove]");
        const removeFieldId = remove?.dataset.objectRemove || remove?.dataset.manyRemove;
        if (remove && removeFieldId && form.contains(remove)) {
          event.preventDefault();
          const index = Number(
            remove.closest<HTMLElement>("[data-object-index], [data-many-index]")?.dataset.objectIndex ??
              remove.closest<HTMLElement>("[data-many-index]")?.dataset.manyIndex,
          );
          if (!commitObjectListChange(form, fileState.schema.fields, draft, { op: "remove", fieldId: removeFieldId, index })) return;
          repaint();
          queueMicrotask(() => focusAfterCollectionRemove(host, removeFieldId, index));
          return;
        }
        const cmd = target?.closest<HTMLElement>("[data-cmd]");
        if (!cmd?.dataset.cmd) return;
        event.preventDefault();
        runRichTextCommand(form, cmd.dataset.cmd, richTextOptions);
      });
      form.addEventListener("mousedown", (event) => {
        if ((event.target as HTMLElement | null)?.closest("[data-cmd]")) event.preventDefault();
      });
    }
    host.querySelectorAll("[data-picker-clear]").forEach((el) => {
      el.addEventListener("click", () => {
        const row = el.closest<HTMLElement>("[data-picker-field]");
        const name = row?.dataset.pickerField;
        if (!name) return;
        const hidden = row?.querySelector<HTMLInputElement>('input[type="hidden"]');
        if (hidden) hidden.value = "";
        const display = row?.querySelector("[data-picker-display]");
        if (display) display.textContent = "None";
        deletePath(draft, name);
      });
    });
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
          if (display) {
            if (field.kind === "asset" && !field.many && typeof value === "string") {
              display.innerHTML = formatAssetDisplay(value);
            } else {
              display.textContent = String(value);
            }
          }
          setPath(draft, name, value);
        });
      });
    });
  }

  paint();
}

function focusCollectionRow(host: ParentNode, fieldId: string, index: number): void {
  const row = collectionRow(host, fieldId, index);
  row?.querySelector<HTMLElement>("input, select, textarea, [contenteditable='true']")?.focus();
}

function focusAfterCollectionRemove(host: ParentNode, fieldId: string, index: number): void {
  const rows = collectionRows(host, fieldId);
  const next = rows[Math.min(index, rows.length - 1)];
  if (next) {
    next.querySelector<HTMLElement>("input, select, textarea, [contenteditable='true']")?.focus();
    return;
  }
  host.querySelector<HTMLButtonElement>(
    `[data-object-add="${CSS.escape(fieldId)}"], [data-many-add="${CSS.escape(fieldId)}"]`,
  )?.focus();
}

function collectionRows(host: ParentNode, fieldId: string): HTMLElement[] {
  const escaped = CSS.escape(fieldId);
  return [...host.querySelectorAll<HTMLElement>(`[data-object-field="${escaped}"], [data-many-field="${escaped}"]`)];
}

function collectionRow(host: ParentNode, fieldId: string, index: number): HTMLElement | null {
  const escaped = CSS.escape(fieldId);
  return host.querySelector<HTMLElement>(
    `[data-object-field="${escaped}"][data-object-index="${index}"], [data-many-field="${escaped}"][data-many-index="${index}"]`,
  );
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

function deletePath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  const last = parts.pop();
  if (!last) return;
  let cur: Record<string, unknown> = obj;
  for (const key of parts) {
    const next = cur[key];
    if (!next || typeof next !== "object") return;
    cur = next as Record<string, unknown>;
  }
  delete cur[last];
}
