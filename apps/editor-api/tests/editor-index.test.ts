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
  });
});
