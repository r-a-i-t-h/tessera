import {
  parseDatasetFilters,
  type DatasetFilter,
  type DatasetFilterOp,
} from "@r-a-i-t-h/tessera-model";
import { normalizeFrameColor } from "@r-a-i-t-h/tessera-sections";
import type { DatasetFieldOption } from "../dataset-field-catalog.js";
import { REORDER_ICONS } from "../editor-icons.js";
import { escapeHtml } from "../dom.js";
import type { ControlValue } from "./nav.js";

export type DatasetPresentation = "table" | "cards" | "list" | "runtimeModule";

export type DatasetDraft = {
  presentation: DatasetPresentation;
  runtimeModuleId: string;
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
  frameColor: string;
  filters: DatasetFilter[];
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type DatasetBindingChoices = {
  datasets: readonly { id: string; title: string }[];
  datasetFields: Readonly<Record<string, readonly DatasetFieldOption[]>>;
  runtimeModules: readonly { id: string; title?: string }[];
};

const COMPONENTS: Record<DatasetPresentation, string> = {
  table: "datasetTable",
  cards: "datasetCards",
  list: "datasetPlainList",
  runtimeModule: "runtimeModule",
};

export function presentationForComponent(component: string): DatasetPresentation | undefined {
  if (component === "datasetTable") return "table";
  if (component === "datasetCards") return "cards";
  if (component === "datasetPlainList") return "list";
  if (component === "runtimeModule") return "runtimeModule";
  return undefined;
}

export function blankDataset(): DatasetDraft {
  return {
    presentation: "table",
    runtimeModuleId: "",
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
    frameColor: "",
    filters: [],
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
  delete propsExtra.frameColor;
  delete propsExtra.filter;
  delete propsExtra.module;
  const sort = isRecord(props.sort) ? props.sort : {};
  const sortField = typeof sort.field === "string" ? sort.field : "";
  const sortDir = sort.dir === "desc" ? "desc" : "asc";
  return {
    presentation,
    runtimeModuleId: typeof props.module === "string" ? props.module : "",
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
    frameColor: typeof props.frameColor === "string" ? props.frameColor : "",
    filters: parseDatasetFilters(props.filter) ?? [],
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
    const frameColor = normalizeFrameColor(draft.frameColor);
    if (frameColor) props.frameColor = frameColor;
    else delete props.frameColor;
  } else {
    delete props.headingField;
    delete props.frameColor;
  }
  if (draft.filters.length) props.filter = draft.filters.map(normalizeFilterForSave);
  else delete props.filter;
  if (draft.presentation === "runtimeModule") {
    const moduleId = draft.runtimeModuleId.trim();
    if (moduleId) props.module = moduleId;
    else delete props.module;
  } else {
    delete props.module;
  }
  return { ...draft.recordExtra, id, component: COMPONENTS[draft.presentation], props };
}

function normalizeFilterForSave(rule: DatasetFilter): DatasetFilter {
  if (rule.op === "notEmpty") return { field: rule.field, op: "hasValue" };
  const base: DatasetFilter = { field: rule.field, op: rule.op };
  if (filterOpNeedsValue(rule.op) && "value" in rule) return { ...base, value: rule.value };
  return base;
}

export function datasetDraftFromForm(
  controls: readonly ControlValue[],
  choices?: DatasetBindingChoices,
  form?: HTMLFormElement,
): DatasetDraft {
  const presentationRaw = valueOf(controls, "dataset-presentation");
  const presentation: DatasetPresentation =
    presentationRaw === "cards" || presentationRaw === "list" || presentationRaw === "runtimeModule"
      ? presentationRaw
      : "table";
  const sortDir = valueOf(controls, "dataset-sort-dir") === "desc" ? "desc" : "asc";
  const datasetId = valueOf(controls, "dataset-dataset");
  const catalog = choices?.datasetFields[datasetId.trim()] ?? [];
  return {
    presentation,
    runtimeModuleId: valueOf(controls, "dataset-runtime-module"),
    datasetId,
    fields: checkedValues(controls, "dataset-field"),
    sortField: valueOf(controls, "dataset-sort-field"),
    sortDir,
    limit: valueOf(controls, "dataset-limit"),
    empty: valueOf(controls, "dataset-empty"),
    interactiveSort: controls.some((c) => c.name === "dataset-interactive-sort" && c.checked),
    showHeader: controls.find((c) => c.name === "dataset-show-header")?.checked !== false,
    compact: controls.some((c) => c.name === "dataset-compact" && c.checked),
    headingField: valueOf(controls, "dataset-heading-field"),
    frameColor: valueOf(controls, "dataset-frame-color"),
    filters: form ? filtersFromForm(form, catalog) : filtersFromControls(controls, catalog),
    propsExtra: parseObject(valueOf(controls, "dataset-props-extra")),
    recordExtra: parseObject(valueOf(controls, "dataset-record-extra")),
  };
}

export function datasetPhrase(
  draft: DatasetDraft,
  datasets: readonly { id: string; title: string }[] = [],
  choices?: Pick<DatasetBindingChoices, "datasetFields">,
): string {
  const datasetId = draft.datasetId.trim();
  const label = datasets.find((d) => d.id === datasetId)?.title.trim() || datasetId || "no dataset";
  const view =
    draft.presentation === "runtimeModule"
      ? "runtime module"
      : draft.presentation === "cards"
        ? "cards"
        : draft.presentation === "list"
          ? "plain list"
          : "table";
  const filterText = filterPhrase(draft.filters, choices?.datasetFields[datasetId] ?? []);
  const sort = draft.sortField.trim() ? `, sorted by ${draft.sortField} ${draft.sortDir}` : "";
  const limit = draft.limit.trim() ? `, limit ${draft.limit.trim()}` : "";
  const interactive = draft.interactiveSort ? ", visitor can re-sort" : "";
  return `Dataset ${view} for ${label}${filterText}${sort}${limit}${interactive}.`;
}

export function datasetBindingError(draft: DatasetDraft, choices?: DatasetBindingChoices): string | undefined {
  if (draft.presentation === "runtimeModule" && !draft.runtimeModuleId.trim()) return "Choose a runtime module.";
  if (!draft.datasetId.trim()) return "Choose a dataset.";
  const trimmed = draft.limit.trim();
  if (trimmed && !/^[1-9]\d*$/.test(trimmed)) return "Limit must be a whole number.";
  const catalog = choices?.datasetFields[draft.datasetId.trim()] ?? [];
  for (const rule of draft.filters) {
    if (!rule.field.trim()) return "Each filter needs a field.";
    if (filterOpNeedsValue(rule.op) && rule.value === undefined) {
      const label = fieldLabel(rule.field, catalog);
      return `Enter a value for filter on ${label}.`;
    }
    if (filterOpNeedsValue(rule.op)) {
      const coerced = coerceFilterValue(rule.field, rule.op, filterValueText(rule), catalog);
      if ("error" in coerced) return coerced.error;
    }
  }
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

const FILTER_OP_LABELS: {
  op: DatasetFilterOp;
  label: string;
  dateOnly?: boolean;
  textOnly?: boolean;
}[] = [
  { op: "eq", label: "equals" },
  { op: "neq", label: "does not equal" },
  { op: "contains", label: "contains", textOnly: true },
  { op: "gte", label: "is at least" },
  { op: "lte", label: "is at most" },
  { op: "empty", label: "is empty" },
  { op: "hasValue", label: "has value" },
  { op: "future", label: "is in the future", dateOnly: true },
  { op: "past", label: "is in the past", dateOnly: true },
];

function filterOpNeedsValue(op: DatasetFilterOp): boolean {
  return op === "eq" || op === "neq" || op === "gte" || op === "lte" || op === "contains";
}

function isTextFilterKind(kind: DatasetFieldOption["kind"]): boolean {
  return kind === "string" || kind === "text";
}

function filterFieldCatalog(catalog: readonly DatasetFieldOption[]): DatasetFieldOption[] {
  const meta: DatasetFieldOption[] = [
    { id: "uid", label: "Uid", kind: "uid" },
    { id: "added", label: "Added", kind: "added" },
    { id: "modified", label: "Modified", kind: "modified" },
  ];
  return [...meta, ...catalog.filter((row) => !meta.some((m) => m.id === row.id))];
}

function fieldKindFor(fieldId: string, catalog: readonly DatasetFieldOption[]): DatasetFieldOption["kind"] {
  return filterFieldCatalog(catalog).find((row) => row.id === fieldId)?.kind ?? "string";
}

function fieldLabel(fieldId: string, catalog: readonly DatasetFieldOption[]): string {
  return filterFieldCatalog(catalog).find((row) => row.id === fieldId)?.label ?? fieldId;
}

function filterValueText(rule: DatasetFilter): string {
  if (rule.value === undefined || rule.value === null) return "";
  if (typeof rule.value === "boolean") return rule.value ? "yes" : "no";
  return String(rule.value);
}

function filterOpSelect(current: DatasetFilterOp, fieldId: string, catalog: readonly DatasetFieldOption[]): string {
  const kind = fieldKindFor(fieldId, catalog);
  const isDate = kind === "date";
  const isText = isTextFilterKind(kind);
  let op = current;
  if ((op === "future" || op === "past") && !isDate) op = "eq";
  if (op === "contains" && !isText) op = "eq";
  const options = FILTER_OP_LABELS.filter(
    (row) => (!row.dateOnly || isDate) && (!row.textOnly || isText),
  ).map(
    (row) =>
      `<option value="${escapeHtml(row.op)}"${row.op === op ? " selected" : ""}>${escapeHtml(row.label)}</option>`,
  );
  return `<select name="dataset-filter-op" class="w3-select w3-border" data-dataset-filter-op>${options.join("")}</select>`;
}

function filterFieldSelect(current: string, catalog: readonly DatasetFieldOption[]): string {
  const ids = filterFieldCatalog(catalog);
  const options = [`<option value=""${!current ? " selected" : ""}>Choose field</option>`].concat(
    ids.map(
      (row) =>
        `<option value="${escapeHtml(row.id)}"${row.id === current ? " selected" : ""}>${escapeHtml(row.label)}</option>`,
    ),
  );
  return `<select name="dataset-filter-field" class="w3-select w3-border" data-dataset-filter-field data-field-kind="${escapeHtml(fieldKindFor(current, catalog))}">${options.join("")}</select>`;
}

function filterValueInput(
  rule: Pick<DatasetFilter, "field" | "op" | "value">,
  catalog: readonly DatasetFieldOption[],
): string {
  if (!filterOpNeedsValue(rule.op)) return "";
  const kind = fieldKindFor(rule.field, catalog);
  const text = filterValueText(rule as DatasetFilter);
  const name = `dataset-filter-value`;
  if (kind === "boolean") {
    const yes = text === "yes" || text === "true" || rule.value === true;
    const no = text === "no" || text === "false" || rule.value === false;
    return `<select name="${name}" class="w3-select w3-border" data-dataset-filter-value>
      <option value=""${!yes && !no ? " selected" : ""}>Choose</option>
      <option value="yes"${yes ? " selected" : ""}>Yes</option>
      <option value="no"${no ? " selected" : ""}>No</option>
    </select>`;
  }
  const field = filterFieldCatalog(catalog).find((row) => row.id === rule.field);
  if (kind === "enum" && field?.enumOptions?.length) {
    return `<select name="${name}" class="w3-select w3-border" data-dataset-filter-value>${[
      `<option value=""${!text ? " selected" : ""}>Choose</option>`,
      ...field.enumOptions.map(
        (opt) =>
          `<option value="${escapeHtml(opt.value)}"${opt.value === text ? " selected" : ""}>${escapeHtml(opt.label)}</option>`,
      ),
    ].join("")}</select>`;
  }
  const inputMode = kind === "number" || kind === "uid" ? ' inputmode="numeric"' : "";
  const placeholder = kind === "date" ? ' placeholder="YYYY-MM-DD"' : "";
  return `<input name="${name}" class="w3-input w3-border" data-dataset-filter-value value="${escapeHtml(text)}"${inputMode}${placeholder} />`;
}

function filterRowHtml(rule: DatasetFilter, catalog: readonly DatasetFieldOption[]): string {
  const valueHidden = !filterOpNeedsValue(rule.op);
  return `<div class="editor-dataset-filter-row editor-add-zone-row" data-dataset-filter-row>
    <p><label>Field</label>${filterFieldSelect(rule.field, catalog)}</p>
    <p><label>Operator</label>${filterOpSelect(rule.op === "notEmpty" ? "hasValue" : rule.op, rule.field, catalog)}</p>
    <p data-dataset-filter-value-wrap${valueHidden ? " hidden" : ""}><label>Value</label>${filterValueInput(rule, catalog)}</p>
    <p class="editor-dataset-filter-actions"><button type="button" class="editor-type-icon" aria-label="Remove" title="Remove" data-dataset-filter-remove>${REORDER_ICONS.remove}</button></p>
  </div>`;
}

function filtersFieldset(draft: DatasetDraft, choices: DatasetBindingChoices): string {
  const datasetId = draft.datasetId.trim();
  const catalog = choices.datasetFields[datasetId] ?? [];
  const body = datasetId
    ? draft.filters.map((rule) => filterRowHtml(rule, catalog)).join("")
    : `<p class="w3-small w3-text-grey">Choose a dataset to add filters.</p>`;
  const addDisabled = datasetId ? "" : " disabled";
  return `<fieldset class="editor-fieldset editor-prop-wide" data-dataset-filters>
    <legend>Row filters</legend>
    <div data-dataset-filter-rows>${body}</div>
    <p><button type="button" class="w3-button w3-white w3-border w3-small" data-dataset-filter-add${addDisabled}>Add filter</button></p>
    <template data-dataset-filter-template>${filterRowHtml({ field: "", op: "eq", value: "" }, catalog)}</template>
  </fieldset>`;
}

function filterPhrasePart(rule: DatasetFilter, catalog: readonly DatasetFieldOption[]): string {
  const label = fieldLabel(rule.field, catalog);
  const op = rule.op === "notEmpty" ? "hasValue" : rule.op;
  switch (op) {
    case "empty":
      return `${label} is empty`;
    case "hasValue":
      return `${label} has value`;
    case "future":
      return `${label} is in the future`;
    case "past":
      return `${label} is in the past`;
    case "eq":
      return `${label} equals ${filterValuePhrase(rule.value)}`;
    case "neq":
      return `${label} not ${filterValuePhrase(rule.value)}`;
    case "contains":
      return `${label} contains ${filterValuePhrase(rule.value)}`;
    case "gte":
      return `${label} at least ${filterValuePhrase(rule.value)}`;
    case "lte":
      return `${label} at most ${filterValuePhrase(rule.value)}`;
    default:
      return label;
  }
}

function filterValuePhrase(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === undefined || value === null) return "…";
  return String(value);
}

function filterPhrase(filters: readonly DatasetFilter[], catalog: readonly DatasetFieldOption[]): string {
  if (!filters.length) return "";
  const parts = filters.map((rule) => filterPhrasePart(rule, catalog));
  return `, filtered by ${parts.join(" and ")}`;
}

/** Read each filter row in DOM order so value inputs stay aligned when some ops hide the value field. */
export function filtersFromForm(form: HTMLFormElement, catalog: readonly DatasetFieldOption[]): DatasetFilter[] {
  const out: DatasetFilter[] = [];
  for (const row of form.querySelectorAll<HTMLElement>("[data-dataset-filter-row]")) {
    const field = row.querySelector<HTMLSelectElement>("[data-dataset-filter-field]")?.value.trim() ?? "";
    const opRaw = row.querySelector<HTMLSelectElement>("[data-dataset-filter-op]")?.value.trim() ?? "";
    if (!field || !isFilterOp(opRaw)) continue;
    const op = opRaw;
    if (!filterOpNeedsValue(op)) {
      out.push({ field, op });
      continue;
    }
    const raw = row.querySelector<HTMLInputElement | HTMLSelectElement>("[data-dataset-filter-value]")?.value ?? "";
    const coerced = coerceFilterValue(field, op, raw, catalog);
    if ("error" in coerced) {
      out.push({ field, op });
      continue;
    }
    out.push({ field, op, value: coerced.value });
  }
  return out;
}

function filtersFromControls(controls: readonly ControlValue[], catalog: readonly DatasetFieldOption[]): DatasetFilter[] {
  const fields = controls.filter((c) => c.name === "dataset-filter-field").map((c) => c.value.trim());
  const ops = controls.filter((c) => c.name === "dataset-filter-op").map((c) => c.value.trim());
  const values = controls.filter((c) => c.name === "dataset-filter-value").map((c) => c.value);
  const out: DatasetFilter[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i] ?? "";
    const opRaw = ops[i] ?? "eq";
    if (!field || !isFilterOp(opRaw)) continue;
    const op = opRaw;
    if (!filterOpNeedsValue(op)) {
      out.push({ field, op });
      continue;
    }
    const raw = values[i] ?? "";
    const coerced = coerceFilterValue(field, op, raw, catalog);
    if ("error" in coerced) {
      out.push({ field, op });
      continue;
    }
    out.push({ field, op, value: coerced.value });
  }
  return out;
}

function isFilterOp(value: string): value is DatasetFilterOp {
  return FILTER_OP_LABELS.some((row) => row.op === value);
}

function coerceFilterValue(
  fieldId: string,
  op: DatasetFilterOp,
  raw: string,
  catalog: readonly DatasetFieldOption[],
): { value: unknown } | { error: string } {
  if (!filterOpNeedsValue(op)) return { value: undefined };
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter a value for this filter." };
  const kind = fieldKindFor(fieldId, catalog);
  if (kind === "boolean") {
    if (trimmed === "yes" || trimmed === "true") return { value: true };
    if (trimmed === "no" || trimmed === "false") return { value: false };
    return { error: "Use Yes or No for this filter." };
  }
  if (kind === "number" || kind === "uid") {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { error: "Enter a number for this filter." };
    return { value: kind === "uid" ? Math.trunc(n) : n };
  }
  return { value: trimmed };
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
  const runtimeOnly = draft.presentation === "runtimeModule";
  return `<div class="editor-props">
    <p><label for="dataset-presentation">Presentation</label>
      <select id="dataset-presentation" name="dataset-presentation" class="w3-select w3-border">
        <option value="table"${draft.presentation === "table" ? " selected" : ""}>Table</option>
        <option value="cards"${draft.presentation === "cards" ? " selected" : ""}>Cards</option>
        <option value="list"${draft.presentation === "list" ? " selected" : ""}>Plain list</option>
        <option value="runtimeModule"${draft.presentation === "runtimeModule" ? " selected" : ""}>Runtime module</option>
      </select></p>
    <p data-dataset-runtime-only${runtimeOnly ? "" : " hidden"}><label for="dataset-runtime-module">Runtime module</label>
      ${runtimeModuleSelect(draft.runtimeModuleId, choices.runtimeModules)}</p>
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
    ${filtersFieldset(draft, choices)}
    <p><label for="dataset-limit">Limit</label>
      <input id="dataset-limit" name="dataset-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
    <p><label for="dataset-empty">Empty message</label>
      <input id="dataset-empty" name="dataset-empty" class="w3-input w3-border" value="${escapeHtml(draft.empty)}" /></p>
    <p class="editor-check"><label><input type="checkbox" name="dataset-interactive-sort"${draft.interactiveSort ? " checked" : ""} /> Let visitors change sort on the page</label></p>
    <p class="editor-check" data-dataset-table-only${tableOnly ? "" : " hidden"}><label><input type="checkbox" name="dataset-show-header"${draft.showHeader ? " checked" : ""} /> Show column headers</label></p>
    <p class="editor-check" data-dataset-table-only${tableOnly ? "" : " hidden"}><label><input type="checkbox" name="dataset-compact"${draft.compact ? " checked" : ""} /> Compact table</label></p>
    <p data-dataset-cards-only${cardsOnly ? "" : " hidden"}><label for="dataset-heading-field">Card title field</label>
      ${headingFieldSelect(draft.headingField, catalog, draft.fields)}</p>
    <p data-dataset-cards-only${cardsOnly ? "" : " hidden"}><label for="dataset-frame-color">Frame colour</label>
      <input id="dataset-frame-color" name="dataset-frame-color" class="w3-input w3-border" value="${escapeHtml(draft.frameColor)}" placeholder="Default" /></p>
  </div>`;
}

export function renderDatasetForm(id: string, draft: DatasetDraft, choices: DatasetBindingChoices): string {
  return `${hiddenExtra("dataset", draft.propsExtra, draft.recordExtra)}${datasetFields(draft, choices)}`;
}

function runtimeModuleSelect(current: string, modules: readonly { id: string; title?: string }[]): string {
  const options = [`<option value=""${!current ? " selected" : ""}>Choose…</option>`].concat(
    modules.map((row) => {
      const label = row.title?.trim() || row.id;
      return `<option value="${escapeHtml(row.id)}"${row.id === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }),
  );
  return `<select id="dataset-runtime-module" name="dataset-runtime-module" class="w3-select w3-border">${options.join("")}</select>`;
}

export function syncDatasetPresentation(form: HTMLFormElement): void {
  const presentation = form.querySelector<HTMLSelectElement>('[name="dataset-presentation"]')?.value ?? "table";
  const tableOnly = presentation === "table";
  const cardsOnly = presentation === "cards";
  const runtimeOnly = presentation === "runtimeModule";
  form.querySelectorAll<HTMLElement>("[data-dataset-table-only]").forEach((el) => {
    el.hidden = !tableOnly;
  });
  form.querySelectorAll<HTMLElement>("[data-dataset-cards-only]").forEach((el) => {
    el.hidden = !cardsOnly;
  });
  form.querySelectorAll<HTMLElement>("[data-dataset-runtime-only]").forEach((el) => {
    el.hidden = !runtimeOnly;
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
  syncDatasetFilterFieldset(form, draft, choices);
}

function syncDatasetFilterFieldset(form: HTMLFormElement, draft: DatasetDraft, choices: DatasetBindingChoices): void {
  const fieldset = form.querySelector<HTMLFieldSetElement>("[data-dataset-filters]");
  if (!fieldset) return;
  const next = filtersFieldset(draft, choices);
  fieldset.outerHTML = next;
}

function refreshFilterRowValue(row: HTMLElement, catalog: readonly DatasetFieldOption[], preserveValue = true): void {
  const fieldId = row.querySelector<HTMLSelectElement>("[data-dataset-filter-field]")?.value ?? "";
  const op = (row.querySelector<HTMLSelectElement>("[data-dataset-filter-op]")?.value ?? "eq") as DatasetFilterOp;
  const valueWrap = row.querySelector<HTMLElement>("[data-dataset-filter-value-wrap]");
  if (!valueWrap) return;
  let existing = "";
  if (preserveValue) {
    existing = row.querySelector<HTMLInputElement | HTMLSelectElement>("[data-dataset-filter-value]")?.value ?? "";
  }
  valueWrap.innerHTML = `<label>Value</label>${filterValueInput({ field: fieldId, op, value: existing }, catalog)}`;
  valueWrap.hidden = !filterOpNeedsValue(op);
}

/** Add/remove filter rows and toggle value fields (safe to call once per form). */
export function bindDatasetFilters(form: HTMLFormElement, choices?: DatasetBindingChoices): void {
  if (form.dataset.datasetFiltersBound === "true") return;
  form.dataset.datasetFiltersBound = "true";

  form.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-dataset-filter-add],[data-dataset-filter-remove]");
    if (!target || !form.contains(target)) return;
    event.preventDefault();
    const fieldset = form.querySelector<HTMLFieldSetElement>("[data-dataset-filters]");
    if (!fieldset) return;
    const rowsHost = fieldset.querySelector<HTMLElement>("[data-dataset-filter-rows]");
    if (!rowsHost) return;

    if (target.matches("[data-dataset-filter-remove]")) {
      target.closest("[data-dataset-filter-row]")?.remove();
      if (!rowsHost.querySelector("[data-dataset-filter-row]")) {
        rowsHost.innerHTML = "";
      }
      return;
    }

    const datasetId = form.querySelector<HTMLSelectElement>('[name="dataset-dataset"]')?.value.trim() ?? "";
    if (!datasetId) return;
    const catalog = choices?.datasetFields[datasetId] ?? [];
    const template = fieldset.querySelector<HTMLTemplateElement>("[data-dataset-filter-template]");
    const html = template?.innerHTML.trim() || filterRowHtml({ field: "", op: "eq", value: "" }, catalog);
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const row = wrap.firstElementChild;
    if (!(row instanceof HTMLElement)) return;
    rowsHost.append(row);
    refreshFilterRowValue(row, catalog, false);
  });

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const row = target.closest<HTMLElement>("[data-dataset-filter-row]");
    if (!row || !form.contains(row)) return;
    const datasetId = form.querySelector<HTMLSelectElement>('[name="dataset-dataset"]')?.value.trim() ?? "";
    const catalog = choices?.datasetFields[datasetId] ?? [];
    if (target.matches("[data-dataset-filter-op]")) {
      refreshFilterRowValue(row, catalog, true);
      return;
    }
    if (target.matches("[data-dataset-filter-field]")) {
      const fieldId = target.value;
      const opSelect = row.querySelector<HTMLSelectElement>("[data-dataset-filter-op]");
      const currentOp = opSelect?.value ?? "eq";
      if (opSelect) opSelect.outerHTML = filterOpSelect(currentOp as DatasetFilterOp, fieldId, catalog);
      refreshFilterRowValue(row, catalog, true);
    }
  });
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
