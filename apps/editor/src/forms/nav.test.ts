import { describe, expect, it } from "vitest";
import { applyNavAction, navEntries, navRows, renderNavList, rowsFromControls, type ControlValue } from "./nav.js";

const sample = [
  { id: "home", title: "Home", sidebar: true, topbar: true, fa: "home" },
  {
    heading: "Site",
    sidebar: true,
    fa: "folder",
    children: [{ id: "about", title: "About", sidebar: true, fa: "info" }],
    source: { pageType: "event", itemsTag: "person", note: "keep" },
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
    expect(html).toContain('name="nav-1-pageType"');
    expect(html).toContain('value="event"');
    expect(html).toContain('name="nav-1-itemsTag"');
    expect(html).toContain('value="person"');
    expect(html).toContain('name="nav-1-topbar"');
    expect(html).toContain('name="nav-1-footer"');
    expect(html).toContain('name="nav-1-child-0-topbar"');
    expect(html).toContain('name="nav-1-child-0-footer"');
    expect(html.match(/>sidebar</g)).toHaveLength(1);
    expect(html.match(/>topbar</g)).toHaveLength(1);
    expect(html.match(/>footer</g)).toHaveLength(1);
    expect(html).toContain('aria-label="Up"');
    expect(html).toContain('aria-label="Remove"');
    expect(html).toContain('data-nav-action="up-child"');
  });

  it("shows sidebar, top bar, and footer on every row even when they are off", () => {
    const html = renderNavList(
      navRows([
        { id: "home", title: "Home" },
        { heading: "Group" },
      ]),
      pages,
    );
    for (const name of ["nav-0-sidebar", "nav-0-topbar", "nav-0-footer", "nav-1-sidebar", "nav-1-topbar", "nav-1-footer"]) {
      const tag = html.match(new RegExp(`<input\\b[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
      expect(tag).toContain('type="checkbox"');
      expect(tag).not.toContain("checked");
    }
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

  it("round-trips a footer flag on a link and a heading", () => {
    const data = [
      { id: "home", title: "Home", footer: true },
      {
        heading: "Fine print",
        footer: true,
        topbar: true,
        children: [{ id: "about", title: "About", footer: true }],
      },
    ];
    const html = renderNavList(navRows(data), pages);
    expect(navEntries(rowsFromControls(controlsIn(html)))).toEqual(data);
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
