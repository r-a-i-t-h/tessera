// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { DatasetField } from "@r-a-i-t-h/tessera-model";
import { commitObjectListChange, compactRecordCollections, readRecordForm, renderRecordForm } from "./record-form.js";

const fields: DatasetField[] = [
  { key: "f1", id: "topic", label: "Topic", kind: "string" },
  {
    key: "f2",
    id: "notes",
    label: "Notes",
    kind: "object",
    many: true,
    fields: [{ key: "f3", id: "body", label: "Body", kind: "string" }],
  },
];

describe("record form page link", () => {
  it("offers a page id on the root record only", () => {
    const html = renderRecordForm(
      {
        uid: 1,
        page: "agm",
        added: "2026-01-01T00:00:00.000Z",
        modified: "2026-01-01T00:00:00.000Z",
        topic: "AGM",
        notes: [{ body: "Minutes", page: "other" }],
      },
      fields,
      { isRoot: true },
    );
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${html}</form>`;
    const pageInputs = host.querySelectorAll("[data-record-page]");
    expect(pageInputs).toHaveLength(1);
    expect(pageInputs[0]).toBeInstanceOf(HTMLInputElement);
    expect((pageInputs[0] as HTMLInputElement).value).toBe("agm");
    expect(host.querySelector(".editor-dataset-object-row [name=page]")).toBeNull();
    expect(host.querySelector(".editor-dataset-object-row")?.textContent).not.toContain("uid");
  });

  it("reads the root page id and leaves nested objects without one", () => {
    const html = renderRecordForm(
      {
        uid: 1,
        page: "agm",
        notes: [{ body: "Minutes" }],
      },
      fields,
      { isRoot: true },
    );
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${html}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    const next = readRecordForm(form as HTMLFormElement, fields, { uid: 1, page: "agm" });
    expect(next.page).toBe("agm");
    expect(next.notes).toEqual([{ body: "Minutes" }]);
  });

  it("starts an empty object collection with only the add button", () => {
    const html = renderRecordForm({ uid: 1, notes: [] }, fields, { isRoot: true });
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${html}</form>`;
    expect(host.querySelector("[data-object-add='notes']")?.textContent).toBe("Add Notes");
    expect(host.querySelector("[data-object-field='notes']")).toBeNull();
    expect(host.querySelector(".editor-dataset-object [name=body]")).toBeNull();
  });

  it("adds an object row and keeps edits already in the form", () => {
    const draft: Record<string, unknown> = { uid: 1, topic: "old", notes: [{ body: "Minutes" }] };
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${renderRecordForm(draft, fields, { isRoot: true })}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    const topic = form!.querySelector<HTMLInputElement>("[name=topic]");
    expect(topic).toBeInstanceOf(HTMLInputElement);
    topic!.value = "updated";
    expect(commitObjectListChange(form as HTMLFormElement, fields, draft, { op: "add", fieldId: "notes" })).toBe(true);
    expect(draft.topic).toBe("updated");
    expect(draft.notes).toEqual([{ body: "Minutes" }, {}]);
  });

  it("removes one object row", () => {
    const draft: Record<string, unknown> = {
      uid: 1,
      notes: [{ body: "Minutes" }, { body: "Follow-up" }],
    };
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${renderRecordForm(draft, fields, { isRoot: true })}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    expect(commitObjectListChange(form as HTMLFormElement, fields, draft, { op: "remove", fieldId: "notes", index: 0 })).toBe(
      true,
    );
    expect(draft.notes).toEqual([{ body: "Follow-up" }]);
  });

  it("reads a legacy string collection as a one-item list", () => {
    const schema: DatasetField[] = [
      { key: "f4", id: "new2", label: "New 2", kind: "string", many: true },
    ];
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${renderRecordForm({ new2: "new 2 data" }, schema, { isRoot: true })}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    const input = form!.querySelector<HTMLInputElement>("[data-many-field='new2'] input");
    expect(input?.value).toBe("new 2 data");
    expect(form!.querySelector("[data-many-remove='new2']")?.getAttribute("aria-label")).toBe("Remove");
    expect(form!.querySelector("[data-many-remove='new2'] svg")).toBeTruthy();
    const next = compactRecordCollections(readRecordForm(form as HTMLFormElement, schema, {}), schema);
    expect(next.new2).toEqual(["new 2 data"]);
  });

  it("drops an untouched object row whose enum is only the blank option", () => {
    const schema: DatasetField[] = [
      {
        key: "f5",
        id: "obj",
        label: "Object1",
        kind: "object",
        many: true,
        fields: [
          { key: "f6", id: "oname", label: "Oname", kind: "string" },
          {
            key: "f8",
            id: "otype",
            label: "Otype",
            kind: "enum",
            options: [
              { value: "cat", label: "cat" },
              { value: "dog", label: "dog" },
            ],
          },
        ],
      },
    ];
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${renderRecordForm(
      { obj: [{ oname: "Pickles", otype: "cat" }, {}] },
      schema,
      { isRoot: true },
    )}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    const selects = form!.querySelectorAll<HTMLSelectElement>("[name=otype]");
    expect(selects).toHaveLength(2);
    expect(selects[0]?.value).toBe("cat");
    expect(selects[1]?.value).toBe("");
    const next = compactRecordCollections(readRecordForm(form as HTMLFormElement, schema, {}), schema);
    expect(next.obj).toEqual([{ oname: "Pickles", otype: "cat" }]);
  });

  it("adds a string collection row without collapsing values already typed", () => {
    const schema: DatasetField[] = [
      { key: "f4", id: "new2", label: "New 2", kind: "string", many: true },
    ];
    const draft: Record<string, unknown> = { new2: ["kept"] };
    const host = document.createElement("div");
    host.innerHTML = `<form id="dataset-record-form">${renderRecordForm(draft, schema)}</form>`;
    const form = host.querySelector("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    const input = form!.querySelector<HTMLInputElement>("[data-many-field='new2'] input");
    expect(input).toBeInstanceOf(HTMLInputElement);
    input!.value = "edited";
    expect(commitObjectListChange(form as HTMLFormElement, schema, draft, { op: "add", fieldId: "new2" })).toBe(true);
    expect(draft.new2).toEqual(["edited", ""]);
  });
});
