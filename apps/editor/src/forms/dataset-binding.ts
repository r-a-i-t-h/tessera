import { escapeHtml } from "../dom.js";
import type { ControlValue } from "./nav.js";

export type DatasetPresentation = "table" | "cards" | "list";

export type DatasetDraft = {
  presentation: DatasetPresentation;
  datasetId: string;
  fields: string[];
  sortField: string;
  sortDir: "asc" | "desc";
  limit: string;
  empty: string;
  interactiveSort: boolean;
  showHeader: boolean;
  compact: boolean;
  headingField: string;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type DatasetBindingChoices = {
  datasets: readonly { id: string; title: string }[];
  datasetFields: Readonly<Record<string, readonly { id: string; label: string }[]>>;
};

const COMPONENTS: Record<DatasetPresentation, string> = {
  table: "datasetTable",
  cards: "datasetCards",
  list: "datasetPlainList",
};

export function presentationForComponent(component: string): DatasetPresentation | undefined {
  if (component === "datasetTable") return "table";
  if (component === "datasetCards") return "cards";
  if (component === "datasetPlainList") return "list";
  return undefined;
}

export function blankDataset(): DatasetDraft {
  return {
    presentation: "table",
    datasetId: "",
    fields: [],
    sortField: "",
    sortDir: "asc",
    limit: "",
    empty: "",
    interactiveSort: false,
    showHeader: true,
    compact: false,
    headingField: "",
    propsExtra: {},
    recordExtra: {},
  };
}

export function datasetDraft(data: unknown): DatasetDraft {
  const record = isRecord(data) ? data : {};
  const component = typeof record.component === "string" ? record.component : "";
  const presentation = presentationForComponent(component) ?? "table";
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.dataset;
  delete propsExtra.fields;
  delete propsExtra.sort;
  delete propsExtra.limit;
  delete propsExtra.empty;
  delete propsExtra.interactiveSort;
  delete propsExtra.showHeader;
  delete propsExtra.compact;
  delete propsExtra.headingField;
  const sort = isRecord(props.sort) ? props.sort : {};
  const sortField = typeof sort.field === "string" ? sort.field : "";
  const sortDir = sort.dir === "desc" ? "desc" : "asc";
  return {
    presentation,
    datasetId: typeof props.dataset === "string" ? props.dataset : "",
    fields: stringList(props.fields) ?? [],
    sortField,
    sortDir,
    limit: limitText(props.limit),
    empty: typeof props.empty === "string" ? props.empty : "",
    interactiveSort: props.interactiveSort === true,
    showHeader: props.showHeader !== false,
    compact: props.compact === true,
    headingField: typeof props.headingField === "string" ? props.headingField : "",
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function datasetRecord(id: string, draft: DatasetDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  const datasetId = draft.datasetId.trim();
  if (datasetId) props.dataset = datasetId;
  else delete props.dataset;
  if (draft.fields.length) props.fields = [...draft.fields];
  else delete props.fields;
  const sortField = draft.sortField.trim();
  if (sortField) props.sort = { field: sortField, dir: draft.sortDir };
  else delete props.sort;
  const limit = limitNumber(draft.limit);
  if (limit !== undefined) props.limit = limit;
  else delete props.limit;
  const empty = draft.empty.trim();
  if (empty) props.empty = empty;
  else delete props.empty;
  if (draft.interactiveSort) props.interactiveSort = true;
  else delete props.interactiveSort;
  if (draft.presentation === "table") {
    if (!draft.showHeader) props.showHeader = false;
    else delete props.showHeader;
    if (draft.compact) props.compact = true;
    else delete props.compact;
  } else {
    delete props.showHeader;
    delete props.compact;
  }
  if (draft.presentation === "cards") {
    const heading = draft.headingField.trim();
    if (heading) props.headingField = heading;
    else delete props.headingField;
  } else {
    delete props.headingField;
  }
  return { ...draft.recordExtra, id, component: COMPONENTS[draft.presentation], props };
}

export function datasetDraftFromForm(controls: readonly ControlValue[]): DatasetDraft {
  const presentationRaw = valueOf(controls, "dataset-presentation");
  const presentation: DatasetPresentation =
    presentationRaw === "cards" || presentationRaw === "list" ? presentationRaw : "table";
  const sortDir = valueOf(controls, "dataset-sort-dir") === "desc" ? "desc" : "asc";
  return {
    presentation,
    datasetId: valueOf(controls, "dataset-dataset"),
    fields: checkedValues(controls, "dataset-field"),
    sortField: valueOf(controls, "dataset-sort-field"),
    sortDir,
    limit: valueOf(controls, "dataset-limit"),
    empty: valueOf(controls, "dataset-empty"),
    interactiveSort: controls.some((c) => c.name === "dataset-interactive-sort" && c.checked),
    showHeader: controls.find((c) => c.name === "dataset-show-header")?.checked !== false,
    compact: controls.some((c) => c.name === "dataset-compact" && c.checked),
    headingField: valueOf(controls, "dataset-heading-field"),
    propsExtra: parseObject(valueOf(controls, "dataset-props-extra")),
    recordExtra: parseObject(valueOf(controls, "dataset-record-extra")),
  };
}

export function datasetPhrase(
  draft: DatasetDraft,
  datasets: readonly { id: string; title: string }[] = [],
): string {
  const datasetId = draft.datasetId.trim();
  const label = datasets.find((d) => d.id === datasetId)?.title.trim() || datasetId || "no dataset";
  const view =
    draft.presentation === "cards" ? "cards" : draft.presentation === "list" ? "plain list" : "table";
  const sort = draft.sortField.trim() ? `, sorted by ${draft.sortField} ${draft.sortDir}` : "";
  const limit = draft.limit.trim() ? `, limit ${draft.limit.trim()}` : "";
  const interactive = draft.interactiveSort ? ", visitor can re-sort" : "";
  return `Dataset ${view} for ${label}${sort}${limit}${interactive}.`;
}

export function datasetBindingError(draft: DatasetDraft): string | undefined {
  if (!draft.datasetId.trim()) return "Choose a dataset.";
  const trimmed = draft.limit.trim();
  if (trimmed && !/^[1-9]\d*$/.test(trimmed)) return "Limit must be a whole number.";
  return undefined;
}

function datasetSelect(current: string, datasets: readonly { id: string; title: string }[]): string {
  const options = [`<option value=""${!current ? " selected" : ""}>Choose a dataset</option>`].concat(
    datasets.map((row) => {
      const label = row.title.trim() || row.id;
      return `<option value="${escapeHtml(row.id)}"${row.id === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }),
  );
  return `<select id="dataset-dataset" name="dataset-dataset" class="w3-select w3-border" data-dataset-picker>${options.join("")}</select>`;
}

export function fieldChecklist(
  name: string,
  selected: readonly string[],
  catalog: readonly { id: string; label: string }[],
): string {
  if (!catalog.length) {
    return `<p class="w3-small w3-text-grey">Choose a dataset to list its fields. Leave all unchecked to show every column.</p>`;
  }
  const ids = [...catalog];
  for (const id of selected) {
    if (id && !ids.some((row) => row.id === id)) ids.push({ id, label: id });
  }
  const allChecked = ids.length > 0 && ids.every((row) => selected.includes(row.id));
  const selectAll = `<p class="editor-check"><label><input type="checkbox" data-dataset-field-all${allChecked ? " checked" : ""} /> Select all</label></p>`;
  return (
    selectAll +
    ids
      .map((row) => {
        const checked = selected.includes(row.id) ? " checked" : "";
        return `<p class="editor-check"><label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(row.id)}"${checked} /> ${escapeHtml(row.label)}</label></p>`;
      })
      .join("")
  );
}

function sortFieldSelect(current: string, catalog: readonly { id: string; label: string }[]): string {
  const meta = [
    { id: "uid", label: "Uid" },
    { id: "added", label: "Added" },
    { id: "modified", label: "Modified" },
  ];
  const ids = [...meta, ...catalog.filter((row) => !meta.some((m) => m.id === row.id))];
  const options = [`<option value=""${!current ? " selected" : ""}>Default</option>`].concat(
    ids.map(
      (row) =>
        `<option value="${escapeHtml(row.id)}"${row.id === current ? " selected" : ""}>${escapeHtml(row.label)}</option>`,
    ),
  );
  return `<select id="dataset-sort-field" name="dataset-sort-field" class="w3-select w3-border">${options.join("")}</select>`;
}

function headingFieldOptions(
  catalog: readonly { id: string; label: string }[],
  selected: readonly string[],
): { id: string; label: string }[] {
  if (!selected.length) return [...catalog];
  const byId = new Map(catalog.map((row) => [row.id, row]));
  const ordered: { id: string; label: string }[] = [];
  for (const id of selected) {
    const row = byId.get(id);
    ordered.push(row ?? { id, label: id });
  }
  for (const row of catalog) {
    if (!selected.includes(row.id)) ordered.push(row);
  }
  return ordered;
}

function headingFieldSelect(
  current: string,
  catalog: readonly { id: string; label: string }[],
  selected: readonly string[],
): string {
  const options = [`<option value=""${!current ? " selected" : ""}>First column</option>`].concat(
    headingFieldOptions(catalog, selected).map(
      (row) =>
        `<option value="${escapeHtml(row.id)}"${row.id === current ? " selected" : ""}>${escapeHtml(row.label)}</option>`,
    ),
  );
  return `<select id="dataset-heading-field" name="dataset-heading-field" class="w3-select w3-border">${options.join("")}</select>`;
}

export function datasetFields(draft: DatasetDraft, choices: DatasetBindingChoices): string {
  const catalog = choices.datasetFields[draft.datasetId.trim()] ?? [];
  const tableOnly = draft.presentation === "table";
  const cardsOnly = draft.presentation === "cards";
  return `<div class="editor-props">
    <p><label for="dataset-presentation">Presentation</label>
      <select id="dataset-presentation" name="dataset-presentation" class="w3-select w3-border">
        <option value="table"${draft.presentation === "table" ? " selected" : ""}>Table</option>
        <option value="cards"${draft.presentation === "cards" ? " selected" : ""}>Cards</option>
        <option value="list"${draft.presentation === "list" ? " selected" : ""}>Plain list</option>
      </select></p>
    <p aria-hidden="true"></p>
    <p><label for="dataset-dataset">Dataset</label>
      ${datasetSelect(draft.datasetId, choices.datasets)}</p>
    <fieldset class="editor-fieldset" data-dataset-columns><legend>Columns</legend>
      ${fieldChecklist("dataset-field", draft.fields, catalog)}
    </fieldset>
    <p><label for="dataset-sort-field">Sort by</label>
      ${sortFieldSelect(draft.sortField, catalog)}</p>
    <p><label for="dataset-sort-dir">Sort direction</label>
      <select id="dataset-sort-dir" name="dataset-sort-dir" class="w3-select w3-border">
        <option value="asc"${draft.sortDir === "asc" ? " selected" : ""}>Ascending</option>
        <option value="desc"${draft.sortDir === "desc" ? " selected" : ""}>Descending</option>
      </select></p>
    <p><label for="dataset-limit">Limit</label>
      <input id="dataset-limit" name="dataset-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
    <p><label for="dataset-empty">Empty message</label>
      <input id="dataset-empty" name="dataset-empty" class="w3-input w3-border" value="${escapeHtml(draft.empty)}" /></p>
    <p class="editor-check"><label><input type="checkbox" name="dataset-interactive-sort"${draft.interactiveSort ? " checked" : ""} /> Let visitors change sort on the page</label></p>
    <p class="editor-check" data-dataset-table-only${tableOnly ? "" : " hidden"}><label><input type="checkbox" name="dataset-show-header"${draft.showHeader ? " checked" : ""} /> Show column headers</label></p>
    <p class="editor-check" data-dataset-table-only${tableOnly ? "" : " hidden"}><label><input type="checkbox" name="dataset-compact"${draft.compact ? " checked" : ""} /> Compact table</label></p>
    <p data-dataset-cards-only${cardsOnly ? "" : " hidden"}><label for="dataset-heading-field">Card title field</label>
      ${headingFieldSelect(draft.headingField, catalog, draft.fields)}</p>
  </div>`;
}

export function renderDatasetForm(id: string, draft: DatasetDraft, choices: DatasetBindingChoices): string {
  return `${hiddenExtra("dataset", draft.propsExtra, draft.recordExtra)}${datasetFields(draft, choices)}`;
}

export function syncDatasetPresentation(form: HTMLFormElement): void {
  const presentation = form.querySelector<HTMLSelectElement>('[name="dataset-presentation"]')?.value ?? "table";
  const tableOnly = presentation === "table";
  const cardsOnly = presentation === "cards";
  form.querySelectorAll<HTMLElement>("[data-dataset-table-only]").forEach((el) => {
    el.hidden = !tableOnly;
  });
  form.querySelectorAll<HTMLElement>("[data-dataset-cards-only]").forEach((el) => {
    el.hidden = !cardsOnly;
  });
}

/** Refresh column checklist and sort/heading pickers after the dataset catalog loads. */
export function syncDatasetCatalogFields(form: HTMLFormElement, draft: DatasetDraft, choices: DatasetBindingChoices): void {
  const catalog = choices.datasetFields[draft.datasetId.trim()] ?? [];
  const columns = form.querySelector<HTMLFieldSetElement>("[data-dataset-columns]");
  if (columns) columns.innerHTML = `<legend>Columns</legend>${fieldChecklist("dataset-field", draft.fields, catalog)}`;
  syncDatasetColumnSelectAll(form);
  const sort = form.querySelector<HTMLSelectElement>('[name="dataset-sort-field"]');
  if (sort) {
    const next = sortFieldSelect(draft.sortField, catalog);
    sort.outerHTML = next;
  }
  const heading = form.querySelector<HTMLSelectElement>('[name="dataset-heading-field"]');
  if (heading) {
    heading.outerHTML = headingFieldSelect(draft.headingField, catalog, draft.fields);
  }
}

/** Keep the Columns “Select all” control in sync with individual field checkboxes. */
export function syncDatasetColumnSelectAll(form: HTMLFormElement): void {
  const fieldset = form.querySelector("[data-dataset-columns]");
  const master = fieldset?.querySelector<HTMLInputElement>("[data-dataset-field-all]");
  const boxes = fieldset?.querySelectorAll<HTMLInputElement>('input[name="dataset-field"]');
  if (!master || !boxes?.length) return;
  master.checked = [...boxes].every((box) => box.checked);
}

/** Select all / column checkbox behaviour (safe to call once per form; uses delegation). */
export function bindDatasetColumnChecklist(form: HTMLFormElement): void {
  if (form.dataset.datasetColumnsBound === "true") return;
  form.dataset.datasetColumnsBound = "true";
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const fieldset = form.querySelector("[data-dataset-columns]");
    if (!fieldset?.contains(target)) return;
    if (target.matches("[data-dataset-field-all]")) {
      fieldset.querySelectorAll<HTMLInputElement>('input[name="dataset-field"]').forEach((box) => {
        box.checked = target.checked;
      });
      return;
    }
    if (target.name === "dataset-field") syncDatasetColumnSelectAll(form);
  });
}

function hiddenExtra(prefix: string, propsExtra: Record<string, unknown>, recordExtra: Record<string, unknown>): string {
  const propsJson = JSON.stringify(propsExtra);
  const recordJson = JSON.stringify(recordExtra);
  return `<input type="hidden" name="${prefix}-props-extra" value="${escapeHtml(propsJson)}" />
    <input type="hidden" name="${prefix}-record-extra" value="${escapeHtml(recordJson)}" />`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordExtra(record: Record<string, unknown>): Record<string, unknown> {
  const extra = { ...record };
  delete extra.id;
  delete extra.component;
  delete extra.props;
  return extra;
}

function stringList(value: unknown): string[] | undefined {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
  return out.length ? out : undefined;
}

function limitText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function limitNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^[1-9]\d*$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

function valueOf(controls: readonly ControlValue[], name: string): string {
  return controls.find((control) => control.name === name)?.value ?? "";
}

function checkedValues(controls: readonly ControlValue[], name: string): string[] {
  return controls.filter((control) => control.name === name && control.checked).map((control) => control.value);
}

function parseObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  } catch {
    return {};
  }
}
