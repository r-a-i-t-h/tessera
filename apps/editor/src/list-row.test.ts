import { describe, expect, it } from "vitest";
import { editorNavListItem, editorRecordTable } from "./list-row.js";

describe("editorNavListItem", () => {
  it("wraps the label in a full-width row link", () => {
    const html = editorNavListItem({
      href: "#/content/about",
      label: "About",
      metaHtml: ` <span class="w3-text-grey w3-small">about</span>`,
    });
    expect(html).toContain('class="editor-list-row"');
    expect(html).toContain('href="#/content/about"');
    expect(html).toContain('<span class="editor-list-primary">About</span>');
    expect(html).not.toContain("<strong>");
  });
});

describe("editorRecordTable", () => {
  it("marks body rows as navigable", () => {
    const html = editorRecordTable(
      [{ href: "#/data/demo", cells: ["<td>demo</td>", "<td>Title</td>"] }],
      ["Id", "Title"],
      2,
    );
    expect(html).toContain("editor-record-table");
    expect(html).toContain('data-list-href="#/data/demo"');
    expect(html).not.toContain("w3-striped");
  });
});
