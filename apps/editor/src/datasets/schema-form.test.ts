// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { DatasetField } from "@r-a-i-t-h/tessera-model";
import {
  applySchemaAction,
  focusSchemaFieldId,
  readSchemaForm,
  renderSchemaForm,
  schemaDraftFromFields,
} from "./schema-form.js";

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
    expect(html).not.toContain("Record metadata");
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
    const draft = readSchemaForm(host, schemaDraftFromFields(fields));
    expect(draft.fields[0]?.dataset).toBe("meetings");
  });

  it("does not offer removed field kinds", () => {
    const html = renderSchemaForm(schemaDraftFromFields(sample));
    expect(html).not.toContain('value="object"');
    expect(html).not.toContain('value="list"');
    expect(html).not.toContain('value="html"');
  });
});
