import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutNodeSchema, type LayoutNode } from "@r-a-i-t-h/tessera-model";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { inspectorHtml, paletteHtml, treeHtml } from "./view.js";
import {
  applyField,
  asLayoutNode,
  cleanNode,
  drawerState,
  getNode,
  isFrame,
  moveSibling,
  newFrame,
  newPageLayout,
  nodeLabel,
  nodesFor,
  paletteFor,
  relocate,
  removeNode,
  scopeForParent,
  stayOpenNote,
  tagOptions,
} from "./tree.js";

const layoutsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../sites/willow/records/layouts");

function load(name: string): LayoutNode {
  const file = parse(readFileSync(join(layoutsDir, name), "utf8")) as { root: unknown };
  const root = asLayoutNode(file.root);
  if (!root) throw new Error(`${name} did not parse`);
  return root;
}

function labels(node: LayoutNode, into: string[] = []): string[] {
  into.push(nodeLabel(node));
  const kids = node.type === "region" ? node.children : node.type === "component" ? (node.children ?? []) : [];
  for (const child of kids) labels(child, into);
  return into;
}

describe("layout arrange tree", () => {
  it("keeps Willow’s master nested and names the menus", () => {
    const root = load("master.yaml");
    expect(isFrame(root)).toBe(true);
    expect(cleanNode(cleanNode(root))).toEqual(cleanNode(root));
    expect(LayoutNodeSchema.safeParse(cleanNode(root)).success).toBe(true);
    const names = labels(root);
    expect(names).toContain("Region : topnav");
    expect(names).toContain("Region : mySidebar");
    expect(names).toContain("HTML : myOverlay");
    expect(names).not.toContain("header");
    expect(names).not.toContain("Overlay");
    expect(names).not.toContain("Close");
    expect(names).not.toContain("Custom HTML");
    expect(names).toContain("Menu · Flat list · Top bar");
    expect(names).toContain("Menu · Flat list · Sidebar");
    expect(names).toContain("Page");
    const html = treeHtml(root, "");
    expect(html).toContain("data-tag=\"header\"");
    expect(html).toContain("data-drawer=\"closed\"");
    expect(html.indexOf("header")).toBeLessThan(html.indexOf("Menu · Flat list · Top bar"));
    const drawer = getNode(root, [1]);
    expect(drawer && drawerState(drawer)).toBe("closed");
    expect(drawer && stayOpenNote(drawer)).toMatch(/site\.css/);
  });

  it("reads a page layout as zones inside regions", () => {
    const root = load("meeting.yaml");
    expect(isFrame(root)).toBe(false);
    expect(labels(root)).toContain("Zone : minutes");
    expect(labels(root)).toContain("agendaList");
    const standard = load("standard.yaml");
    expect(labels(standard)).toContain("Zone : aside");
    expect(getNode(standard, [1, 3, 1])?.type).toBe("region");
  });

  it("moves a child down without losing it", () => {
    let root = newPageLayout("sample").root;
    root = moveSibling(root, [0], 1);
    expect(root.type === "region" && root.children.map((node) => node.type)).toEqual(["zone", "region"]);
    root = moveSibling(root, [1], -1);
    expect(root.type === "region" && root.children[0]?.type).toBe("region");
  });

  it("moves a node into another region and refuses a move into itself", () => {
    const root = newPageLayout("sample").root;
    const moved = relocate(root, [1], [0], 1);
    expect(getNode(moved, [0])?.type).toBe("region");
    const heading = getNode(moved, [0]);
    expect(heading?.type === "region" && heading.children.map((node) => (node.type === "zone" ? node.id : node.type))).toEqual([
      "title",
      "main",
    ]);
    expect(relocate(moved, [0], [0, 0], 0)).toEqual(moved);
  });

  it("keeps the only page slot", () => {
    const root = newFrame("master").root;
    expect(removeNode(root, [0, 0])).toEqual({ ok: false, error: "A frame keeps its page slot." });
  });

  it("writes w3-collapse for stay open and leaves the other classes", () => {
    const root = load("master.yaml");
    const drawer = getNode(root, [1]);
    if (drawer?.type !== "region") throw new Error("expected the drawer");
    const open = applyField(drawer, "stayOpen", "true");
    expect(open.type === "region" && open.className).toContain("wh-drawer");
    expect(open.type === "region" && open.className).toContain("w3-collapse");
    expect(drawerState(open)).toBe("open");
    const shut = applyField(open, "stayOpen", "false");
    expect(shut.type === "region" && shut.className?.includes("w3-collapse")).toBe(false);
  });

  it("builds columns, a side menu, and a fresh zone id", () => {
    const page = newPageLayout("sample").root;
    const columns = nodesFor("columns2", page);
    expect(columns.ok && columns.nodes[0]?.type === "region" && columns.nodes[0].className).toContain("w3-row-padding");
    const frame = newFrame("master").root;
    const side = nodesFor("sidemenu", frame);
    expect(side.ok && JSON.stringify(side.nodes)).toContain("mySidebar");
    expect(side.ok && JSON.stringify(side.nodes)).toContain("myOverlay");
    expect(nodesFor("page", frame).ok).toBe(false);
    expect(nodesFor("zone", frame).ok).toBe(false);
    const added = nodesFor("zone", page);
    expect(added.ok && added.nodes[0]?.type === "zone" && added.nodes[0].id).toBe("zone2");
  });

  it("points a menu at the top bar when that is the parent", () => {
    const header: LayoutNode = { type: "region", tag: "header", children: [] };
    expect(scopeForParent(header)).toBe("topbar");
    expect(tagOptions("raith")).toContain("raith");
    expect(tagOptions(undefined)).not.toContain("raith");
  });

  it("names a box from its kind and id", () => {
    expect(nodeLabel({ type: "region", children: [] })).toBe("Region");
    expect(nodeLabel({ type: "region", id: "mySidebar", children: [] })).toBe("Region : mySidebar");
    expect(nodeLabel({ type: "zone", id: "footer" })).toBe("Zone : footer");
    expect(nodeLabel({ type: "static", html: '<div id="myOverlay"></div>' })).toBe("HTML : myOverlay");
    expect(nodeLabel({ type: "static", html: "<p>Footer</p>" })).toBe("HTML");
  });

  it("starts custom HTML as an empty fragment edited as HTML", () => {
    const page = newPageLayout("sample").root;
    const made = nodesFor("html", page);
    expect(made.ok && made.nodes).toEqual([{ type: "static", html: "" }]);
    if (!made.ok) return;
    const html = inspectorHtml(made.nodes[0], { layoutId: "sample", master: false, fallback: false, typeIds: [] }, false);
    expect(html).toContain('data-field="html"');
    expect(html).not.toContain('data-field="paragraph"');
    expect(html).toContain("The list names this box from its id.");
  });

  it("groups the frame palette", () => {
    expect(paletteFor(true).flat().map((item) => item.label)).toEqual([
      "Header",
      "Region",
      "Footer",
      "Page",
      "Side menu",
      "Menu",
      "Breadcrumbs",
      "Custom HTML",
      "Font switch",
    ]);
    expect(paletteHtml(true).match(/editor-palette-rule/g)).toHaveLength(3);
    expect(paletteFor(false).flat().map((item) => item.label)).toEqual([
      "Region",
      "Zone",
      "Two columns",
      "Three columns",
      "Heading",
      "Component",
      "Custom HTML",
    ]);
  });

  it("sets a column width without dropping w3-col", () => {
    const column: LayoutNode = { type: "region", className: "w3-col m6", children: [] };
    const wider = applyField(column, "columnWidth", "m7");
    expect(wider.type === "region" && wider.className).toBe("w3-col m7");
  });
});
