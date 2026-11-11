// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { DatasetField } from "@r-a-i-t-h/tessera-model";
import { readRecordForm, renderRecordForm } from "./record-form.js";

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
});
