import { describe, expect, it } from "vitest";
import { applyNavAction, navEntries, navRows, renderNavList, rowsFromControls, type ControlValue } from "./nav.js";

const sample = [
  { id: "home", title: "Home", sidebar: true, topbar: true, fa: "home" },
  {
    heading: "Site",
    sidebar: true,
    fa: "folder",
    children: [{ id: "about", title: "About", sidebar: true, fa: "info" }],
    source: { pagesTag: "event", itemsTag: "person", note: "keep" },
  },
];

const pages = [
  { id: "home", title: "Home" },
  { id: "about", title: "About" },
];

describe("nav list", () => {
  it("renders links, headings, nested links, and tag fields", () => {
    const html = renderNavList(navRows(sample), pages);
    expect(html).toContain("Add link");
    expect(html).toContain("Add heading");
    expect(html).toContain(">Home (home)<");
    expect(html).toContain('value="Site"');
    expect(html).toContain('value="About"');
    expect(html).toContain('name="nav-1-pagesTag"');
    expect(html).toContain('value="event"');
    expect(html).toContain('name="nav-1-itemsTag"');
    expect(html).toContain('value="person"');
    expect(html).toContain("Links under this heading");
  });

  it("reorders top-level rows and links under a heading", () => {
    const rows = navRows([
      { id: "home", title: "Home", sidebar: true },
      { id: "news", title: "News", sidebar: true },
      {
        heading: "More",
        sidebar: true,
        children: [
          { id: "a", title: "A", sidebar: true },
          { id: "b", title: "B", sidebar: true },
        ],
      },
    ]);
    const swapped = applyNavAction(rows, "down", 0);
    expect(swapped.map((row) => (row.kind === "link" ? row.id : row.heading))).toEqual(["news", "home", "More"]);
    const nested = applyNavAction(swapped, "down-child", 2, 0);
    const heading = nested[2];
    expect(heading?.kind).toBe("heading");
    if (heading?.kind === "heading") expect(heading.children.map((child) => child.id)).toEqual(["b", "a"]);
  });

  it("round-trips a heading with children, a tag source, and extra keys", () => {
    const html = renderNavList(navRows(sample), pages);
    const read = navEntries(rowsFromControls(controlsIn(html)));
    expect(read).toEqual(sample);
    expect(navEntries(navRows(sample))).toEqual(sample);
  });
});

function controlsIn(html: string): ControlValue[] {
  const controls: ControlValue[] = [];
  for (const match of html.matchAll(/<input\b([^>]*?)\/?>/g)) {
    const attrs = attrsOf(match[1] ?? "");
    if (!attrs.name) continue;
    controls.push({
      name: attrs.name,
      value: attrs.value ?? "",
      checked: attrs.type === "checkbox" ? Object.prototype.hasOwnProperty.call(attrs, "checked") : undefined,
    });
  }
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const attrs = attrsOf(match[1] ?? "");
    if (!attrs.name) continue;
    const options = [...(match[2] ?? "").matchAll(/<option\b([^>]*)>/g)];
    const selected = options.find((option) => /(?:^|\s)selected(?:\s|=|$)/.test(option[1] ?? ""));
    const chosen = attrsOf((selected ?? options[0])?.[1] ?? "");
    controls.push({ name: attrs.name, value: chosen.value ?? "" });
  }
  return controls;
}

function attrsOf(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) {
    const key = match[1];
    if (!key) continue;
    attrs[key] = match[2] !== undefined ? decodeAttr(match[2]) : "";
  }
  return attrs;
}

function decodeAttr(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
