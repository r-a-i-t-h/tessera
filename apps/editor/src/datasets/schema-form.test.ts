// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseDatasetFields, type DatasetField } from "@r-a-i-t-h/tessera-model";
import {
  applySchemaAction,
  applySchemaSubAction,
  closeSchemaHelp,
  focusSchemaFieldId,
  focusSchemaKindEditor,
  readSchemaForm,
  readViewColumnsFromSchemaForm,
  renderSchemaForm,
  schemaDraftFromFields,
  toggleSchemaHelp,
  validateSchemaDraft,
} from "./schema-form.js";

/** happy-dom applies `selected` to the wrong option when it is not the first or second. */
function applySelectedAttributes(root: ParentNode): void {
  for (const select of root.querySelectorAll("select")) {
    const chosen = select.querySelector("option[selected]");
    if (chosen instanceof HTMLOptionElement) select.value = chosen.getAttribute("value") ?? "";
  }
}

const sample: DatasetField[] = [
  { key: "a", id: "title", label: "Title", kind: "string", required: true },
  { key: "b", id: "count", label: "Count", kind: "number" },
];

describe("schema form", () => {
  it("renders reorder icons like the type editor", () => {
    const html = renderSchemaForm(schemaDraftFromFields(sample));
    expect(html).toContain('aria-label="Up"');
    expect(html).toContain('class="editor-type-icon"');
    expect(html).not.toContain("editor-icon-button");
  });

  it("shows an empty state when there are no fields", () => {
    const html = renderSchemaForm(schemaDraftFromFields([]));
    expect(html).toContain("No fields yet");
    expect(html).toContain("editor-dataset-schema-meta-visible");
  });

  it("allows id and title as schema fields", () => {
    const fields: DatasetField[] = [
      { key: "f1", id: "id", label: "Slug", kind: "string", required: true },
      { key: "f2", id: "title", label: "Title", kind: "string", required: true },
    ];
    expect(() => renderSchemaForm(schemaDraftFromFields(fields))).not.toThrow();
  });

  it("focuses the field id input for a row", async () => {
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(sample));
    document.body.appendChild(host);
    focusSchemaFieldId(host, 0, 1);
    await new Promise((r) => queueMicrotask(r));
    const active = host.querySelector<HTMLInputElement>('input[data-schema-id="1"][data-depth="0"]');
    expect(document.activeElement).toBe(active);
    host.remove();
  });

  it("reads all root fields and preserves edits when adding a field", () => {
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(sample));
    let draft = schemaDraftFromFields(sample);
    draft = readSchemaForm(host, draft);
    expect(draft.fields.map((f) => f.id)).toEqual(["title", "count"]);

    const titleInput = host.querySelector<HTMLInputElement>('[data-schema-id="0"][data-depth="0"]');
    titleInput!.value = "headline";
    draft = readSchemaForm(host, draft);
    draft = applySchemaAction(draft, "add", 0);
    host.innerHTML = renderSchemaForm(draft);
    draft = readSchemaForm(host, draft);
    expect(draft.fields).toHaveLength(3);
    expect(draft.fields[0]?.id).toBe("headline");
    expect(draft.fields[1]?.id).toBe("count");
  });

  it("reads ref dataset from select", () => {
    const fields: DatasetField[] = [
      { key: "r", id: "meeting", label: "Meeting", kind: "ref", dataset: "meetings" },
    ];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields), {
      datasetOptions: [{ id: "meetings", title: "Meetings" }],
    });
    const kindSelect = host.querySelector<HTMLSelectElement>('[data-schema-kind="0"][data-depth="0"]');
    kindSelect!.value = "ref";
    const draft = readSchemaForm(host, schemaDraftFromFields(fields));
    expect(draft.fields[0]?.dataset).toBe("meetings");
  });

  it("reads the kind from the select value, not a stale selected attribute", () => {
    const fields: DatasetField[] = [{ key: "f1", id: "link", label: "Link", kind: "string" }];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
    const select = host.querySelector<HTMLSelectElement>('[data-schema-kind="0"][data-depth="0"]');
    expect(select).toBeTruthy();
    select!.querySelector('option[value="string"]')?.setAttribute("selected", "");
    select!.value = "url";
    const draft = readSchemaForm(host, schemaDraftFromFields(fields));
    expect(draft.fields[0]?.kind).toBe("url");
  });

  it("reads view column checkboxes in schema order", () => {
    const fields: DatasetField[] = [
      { key: "a", id: "title", label: "Title", kind: "string" },
      { key: "b", id: "count", label: "Count", kind: "number" },
    ];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields, ["uid", "title"]));
    const draft = schemaDraftFromFields(fields);
    expect(readViewColumnsFromSchemaForm(host, draft)).toEqual(["uid", "title"]);
  });

  it("stores view columns on the schema draft when reading the form", () => {
    const fields: DatasetField[] = [{ key: "a", id: "title", label: "Title", kind: "string" }];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields, []));
    host.querySelector<HTMLInputElement>('[data-schema-visible="0"]')!.checked = true;
    host.querySelector<HTMLInputElement>('[data-view-col="uid"]')!.checked = true;
    const draft = readSchemaForm(host, schemaDraftFromFields(fields));
    expect(draft.viewColumns).toEqual(["uid", "title"]);
  });

  it("renders visible checkboxes on schema rows", () => {
    const html = renderSchemaForm(schemaDraftFromFields(sample), { viewColumns: ["title"] });
    expect(html).toContain("data-schema-visible");
    expect(html).toContain('data-view-col="uid"');
  });

  it("offers object, text, and html field kinds", () => {
    const html = renderSchemaForm(schemaDraftFromFields(sample));
    expect(html).toContain('value="object"');
    expect(html).toContain('value="html"');
    expect(html).toContain('value="text"');
    expect(html).not.toContain('value="list"');
  });

  it("shows the enum options editor after the kind select changes", () => {
    const fields: DatasetField[] = [{ key: "f1", id: "status", label: "Status", kind: "string" }];
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
      expect(host.querySelector("[data-schema-enum]")).toBeNull();
      host.querySelector<HTMLSelectElement>('[data-schema-kind="0"]')!.value = "enum";
      const draft = readSchemaForm(host, schemaDraftFromFields(fields));
      host.innerHTML = renderSchemaForm(draft);
      const area = host.querySelector<HTMLTextAreaElement>("[data-schema-enum]");
      expect(area).toBeTruthy();
      expect(area?.closest(".editor-type-line")).toBeNull();
      expect(area?.closest(".editor-schema-enum")?.previousElementSibling?.classList.contains("editor-type-line")).toBe(true);
      expect(host.querySelector("[data-schema-help]")).toBeTruthy();
      expect(host.querySelector(".editor-schema-help-pop")?.textContent).toContain("value|label");
      host.querySelector<HTMLSelectElement>('[data-schema-kind="0"]')!.value = "enum";
      area!.value = "open|Open\narchived";
      const saved = readSchemaForm(host, draft);
      expect(saved.fields[0]?.options).toEqual([
        { value: "open", label: "Open" },
        { value: "archived", label: "archived" },
      ]);
    } finally {
      host.remove();
    }
  });

  it("shows enum options for an object subfield when its kind changes", () => {
    const fields: DatasetField[] = [
      {
        key: "o",
        id: "addr",
        label: "Address",
        kind: "object",
        fields: [{ key: "s", id: "kind", label: "Kind", kind: "string" }],
      },
    ];
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
      expect(host.querySelector("[data-schema-sub-kind]")).toBeTruthy();
      expect(host.querySelector("[data-schema-enum]")).toBeNull();
      host.querySelector<HTMLSelectElement>('[data-schema-kind="0"]')!.value = "object";
      host.querySelector<HTMLSelectElement>("[data-schema-sub-kind]")!.value = "enum";
      const draft = readSchemaForm(host, schemaDraftFromFields(fields));
      expect(draft.fields[0]?.fields?.[0]?.kind).toBe("enum");
      host.innerHTML = renderSchemaForm(draft);
      const subEnum = host.querySelector("textarea[data-schema-enum][data-schema-sub]");
      expect(subEnum).toBeTruthy();
      expect(subEnum?.closest(".editor-type-line")).toBeNull();
      expect(subEnum?.closest(".editor-schema-enum")?.previousElementSibling?.classList.contains("editor-type-line")).toBe(true);
      expect(host.querySelector("[data-schema-help]")).toBeTruthy();
    } finally {
      host.remove();
    }
  });

  it("opens and closes the enum format note", () => {
    const fields: DatasetField[] = [
      { key: "f1", id: "status", label: "Status", kind: "enum", options: [{ value: "open", label: "Open" }] },
    ];
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
      const button = host.querySelector<HTMLButtonElement>("[data-schema-help]")!;
      const pop = host.querySelector<HTMLElement>(".editor-schema-help-pop")!;
      expect(pop.hidden).toBe(true);
      toggleSchemaHelp(button);
      expect(pop.hidden).toBe(false);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(closeSchemaHelp(host)).toBe(true);
      expect(pop.hidden).toBe(true);
      expect(button.getAttribute("aria-expanded")).toBe("false");
    } finally {
      host.remove();
    }
  });

  it("focuses the enum options box after a kind change", async () => {
    const fields: DatasetField[] = [
      { key: "f1", id: "status", label: "Status", kind: "enum", options: [{ value: "open", label: "Open" }] },
    ];
    const host = document.createElement("div");
    document.body.appendChild(host);
    try {
      host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
      focusSchemaKindEditor(host, 0, undefined, "enum");
      await new Promise((r) => queueMicrotask(r));
      expect(document.activeElement).toBe(host.querySelector("[data-schema-enum]"));
    } finally {
      host.remove();
    }
  });

  it("assigns a subtype key that is not already used by the parent field", () => {
    const fields: DatasetField[] = [{ key: "f1", id: "address", label: "Address", kind: "string" }];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields));
    host.querySelector<HTMLSelectElement>('[data-schema-kind="0"]')!.value = "object";
    let draft = readSchemaForm(host, schemaDraftFromFields(fields));
    draft = applySchemaAction(draft, "add-object-sub", 0);
    expect(draft.fields[0]?.key).toBe("f1");
    expect(draft.fields[0]?.fields?.[0]?.key).toBe("f2");

    host.innerHTML = renderSchemaForm(draft);
    applySelectedAttributes(host);
    host.querySelector<HTMLInputElement>("[data-schema-sub-key]")!.value = "f1";
    host.querySelector<HTMLInputElement>("[data-schema-sub-id]")!.value = "city";
    host.querySelector<HTMLInputElement>("[data-schema-sub-label]")!.value = "City";
    draft = readSchemaForm(host, draft);
    expect(draft.fields[0]?.fields?.[0]?.key).toBe("f2");
    expect(validateSchemaDraft(draft.fields)).toBeUndefined();
    expect(() => parseDatasetFields(draft.fields)).not.toThrow();
  });

  it("keeps ref and enum details on the subfield that owns them", () => {
    const fields: DatasetField[] = [
      {
        key: "f1",
        id: "person",
        label: "Person",
        kind: "object",
        fields: [
          { key: "f2", id: "home", label: "Home", kind: "ref", dataset: "places", required: true },
          { key: "f3", id: "work", label: "Work", kind: "ref", dataset: "offices" },
          {
            key: "f4",
            id: "status",
            label: "Status",
            kind: "enum",
            options: [{ value: "open", label: "Open" }],
            many: true,
          },
        ],
      },
    ];
    const host = document.createElement("div");
    host.innerHTML = renderSchemaForm(schemaDraftFromFields(fields), {
      datasetOptions: [
        { id: "places", title: "Places" },
        { id: "offices", title: "Offices" },
      ],
    });
    expect(host.innerHTML).toContain('data-schema-sub="1"');
    expect(host.innerHTML).toContain('value="offices" selected');
    applySelectedAttributes(host);
    const selects = [...host.querySelectorAll<HTMLSelectElement>("[data-schema-dataset]")];
    expect(selects.map((select) => select.value)).toEqual(["places", "offices"]);
    selects[1]!.value = "places";
    host.querySelector<HTMLTextAreaElement>("[data-schema-enum]")!.value = "away|Away";
    const draft = readSchemaForm(host, schemaDraftFromFields(fields));
    const subs = draft.fields[0]?.fields ?? [];
    expect(subs.map((field) => field.dataset)).toEqual(["places", "places", undefined]);
    expect(subs[0]?.required).toBe(true);
    expect(subs[1]?.required).toBeUndefined();
    expect(subs[2]?.many).toBe(true);
    expect(subs[2]?.options).toEqual([{ value: "away", label: "Away" }]);

    host.querySelector<HTMLSelectElement>("[data-schema-sub-kind]")!.value = "string";
    const cleared = readSchemaForm(host, draft);
    expect(cleared.fields[0]?.fields?.[0]?.kind).toBe("string");
    expect(cleared.fields[0]?.fields?.[0]?.dataset).toBeUndefined();
    expect(cleared.fields[0]?.fields?.[0]?.required).toBe(true);
  });

  it("reorders and removes subtype fields", () => {
    const fields: DatasetField[] = [
      {
        key: "f1",
        id: "address",
        label: "Address",
        kind: "object",
        fields: [
          { key: "f2", id: "city", label: "City", kind: "string" },
          { key: "f3", id: "region", label: "Region", kind: "string" },
        ],
      },
    ];
    let draft = schemaDraftFromFields(fields);
    draft = applySchemaSubAction(draft, "down", 0, 0);
    expect(draft.fields[0]?.fields?.map((field) => field.id)).toEqual(["region", "city"]);
    draft = applySchemaSubAction(draft, "remove", 0, 0);
    expect(draft.fields[0]?.fields?.map((field) => field.id)).toEqual(["city"]);
  });

  it("rejects duplicate ids and keys across a subtype", () => {
    expect(
      validateSchemaDraft([
        {
          key: "f1",
          id: "city",
          label: "City",
          kind: "object",
          fields: [{ key: "f1", id: "name", label: "Name", kind: "string" }],
        },
      ]),
    ).toBe("Field key f1 is listed twice.");
    expect(
      validateSchemaDraft([
        {
          key: "f1",
          id: "city",
          label: "City",
          kind: "object",
          fields: [{ key: "f2", id: "city", label: "City", kind: "string" }],
        },
      ]),
    ).toBe("Field id city is listed twice.");
  });

  it("requires at least one enum option", () => {
    expect(
      validateSchemaDraft([{ key: "f1", id: "status", label: "Status", kind: "enum", options: [] }]),
    ).toMatch(/needs at least one option/);
    expect(
      validateSchemaDraft([
        {
          key: "o",
          id: "addr",
          label: "Address",
          kind: "object",
          fields: [{ key: "s", id: "kind", label: "Kind", kind: "enum" }],
        },
      ]),
    ).toMatch(/kind/);
  });
});
