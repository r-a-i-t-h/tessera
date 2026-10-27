/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { datasetBindingError, datasetDraftFromForm, filtersFromForm } from "./dataset-binding.js";
import type { ControlValue } from "./nav.js";

const catalog = [{ id: "name", label: "Name", kind: "string" as const }];

function filterForm(html: string): HTMLFormElement {
  const form = document.createElement("form");
  form.innerHTML = html;
  document.body.append(form);
  return form;
}

describe("filtersFromForm", () => {
  it("reads equals/contains values per row when another row has no value control", () => {
    const form = filterForm(`
      <div data-dataset-filter-row>
        <select name="dataset-filter-field" data-dataset-filter-field><option value="name" selected>Name</option></select>
        <select name="dataset-filter-op" data-dataset-filter-op><option value="hasValue" selected>has value</option></select>
      </div>
      <div data-dataset-filter-row>
        <select name="dataset-filter-field" data-dataset-filter-field><option value="name" selected>Name</option></select>
        <select name="dataset-filter-op" data-dataset-filter-op><option value="contains" selected>contains</option></select>
        <input name="dataset-filter-value" data-dataset-filter-value value="north" />
      </div>
    `);
    expect(filtersFromForm(form, catalog)).toEqual([
      { field: "name", op: "hasValue" },
      { field: "name", op: "contains", value: "north" },
    ]);
    expect(datasetBindingError({ ...blankDatasetLike(), filters: filtersFromForm(form, catalog) }, { datasetFields: { x: catalog } })).toBeUndefined();
  });
});

function blankDatasetLike() {
  return {
    presentation: "table" as const,
    datasetId: "x",
    fields: [] as string[],
    sortField: "",
    sortDir: "asc" as const,
    limit: "",
    empty: "",
    interactiveSort: false,
    showHeader: true,
    compact: false,
    headingField: "",
    frameColor: "",
    propsExtra: {},
    recordExtra: {},
  };
}

describe("datasetDraftFromForm", () => {
  it("uses the live form for filter rows", () => {
    const form = filterForm(`
      <input name="dataset-dataset" value="items" />
      <div data-dataset-filter-row>
        <select name="dataset-filter-field" data-dataset-filter-field><option value="name" selected>Name</option></select>
        <select name="dataset-filter-op" data-dataset-filter-op><option value="eq" selected>equals</option></select>
        <input name="dataset-filter-value" data-dataset-filter-value value="Alpha" />
      </div>
    `);
    const controls: ControlValue[] = [{ name: "dataset-dataset", value: "items" }];
    const draft = datasetDraftFromForm(controls, { datasets: [], datasetFields: { items: catalog } }, form);
    expect(draft.filters).toEqual([{ field: "name", op: "eq", value: "Alpha" }]);
  });
});
