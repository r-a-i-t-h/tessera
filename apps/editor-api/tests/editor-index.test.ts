import { describe, expect, it } from "vitest";
import { buildEditorIndex } from "../src/site/editor-index.js";
import type { RecordSummary } from "../src/site/store.js";

describe("buildEditorIndex", () => {
  it("maps content rows to page, article, and blog categories", () => {
    const records: RecordSummary[] = [
      { kind: "content", id: "home", title: "Home" },
      { kind: "content", id: "post", type: "article", title: "Post", parentId: "news" },
      { kind: "content", id: "news", type: "blog", title: "News" },
      { kind: "layouts", id: "master" },
    ];
    const { items } = buildEditorIndex({
      records,
      datasets: [],
      users: [],
      admin: true,
      siteListingVersion: "1",
      datasetListingVersion: "0",
    });
    const page = items.find((i) => i.label === "Home");
    expect(page?.category).toBe("Page");
    expect(page?.hash).toBe("#/content/home");
    expect(items.find((i) => i.label === "Post")?.category).toBe("Article");
    expect(items.find((i) => i.label === "News")?.category).toBe("Blog");
    expect(items.find((i) => i.label === "master")?.category).toBe("Layouts");
  });

  it("lists Editor and Action destinations before content categories", () => {
    const records: RecordSummary[] = [
      { kind: "content", id: "aaa-first-page", title: "AAA First page" },
      { kind: "content", id: "home", title: "Home" },
    ];
    const { items } = buildEditorIndex({
      records,
      datasets: [],
      users: [],
      admin: true,
      siteListingVersion: "1",
      datasetListingVersion: "0",
    });
    const firstNonPinned = items.findIndex((i) => i.category !== "Editor" && i.category !== "Action");
    expect(firstNonPinned).toBeGreaterThan(0);
    for (let i = 0; i < firstNonPinned; i++) {
      expect(["Editor", "Action"]).toContain(items[i]!.category);
    }
    expect(items[0]?.label).toBe("Open preview");
    const firstEditor = items.findIndex((i) => i.category === "Editor");
    expect(firstEditor).toBe(1);
    let lastEditor = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i]!.category === "Editor") lastEditor = i;
    }
    const renderIdx = items.findIndex((i) => i.label === "Render preview");
    expect(renderIdx).toBeGreaterThan(lastEditor);
    const aaa = items.findIndex((i) => i.label === "AAA First page");
    expect(aaa).toBeGreaterThanOrEqual(firstNonPinned);
    expect(items[aaa]?.category).toBe("Page");
  });

  it("lists data grid and dataset setup for each dataset", () => {
    const { items } = buildEditorIndex({
      records: [],
      datasets: [{ id: "cars", title: "Cars", recordCount: 1, invalidCount: 0 }],
      users: [],
      admin: true,
      siteListingVersion: "1",
      datasetListingVersion: "1",
    });
    expect(items.filter((i) => i.label === "Cars")).toEqual([
      expect.objectContaining({ category: "Data", hash: "#/data/cars" }),
      expect.objectContaining({ category: "Dataset", hash: "#/records/datasets/cars" }),
    ]);
  });

  it("omits admin-only datasets and users for limited editors", () => {
    const { items } = buildEditorIndex({
      records: [{ kind: "content", id: "home", title: "Home" }],
      datasets: [{ id: "cars", title: "Cars", recordCount: 1, invalidCount: 0 }],
      users: ["admin"],
      admin: false,
      siteListingVersion: "1",
      datasetListingVersion: "1",
    });
    expect(items.some((i) => i.category === "Dataset")).toBe(false);
    expect(items.some((i) => i.category === "User")).toBe(false);
    expect(items.some((i) => i.label === "Styles")).toBe(false);
    expect(items.some((i) => i.action === "render")).toBe(true);
    expect(items.some((i) => i.label === "Open preview" && i.href === "/preview/")).toBe(true);
    expect(items.some((i) => i.label === "Open published site")).toBe(false);
  });

  it("points Open published site at the live origin when set", () => {
    const { items } = buildEditorIndex({
      records: [{ kind: "content", id: "home", title: "Home" }],
      datasets: [],
      users: [],
      admin: true,
      siteListingVersion: "1",
      datasetListingVersion: "0",
      siteOrigin: "https://hall.example/",
    });
    const open = items.find((i) => i.label === "Open published site");
    expect(open?.href).toBe("https://hall.example/");
  });
});
