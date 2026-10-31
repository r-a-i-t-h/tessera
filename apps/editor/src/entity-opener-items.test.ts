import { describe, expect, it } from "vitest";
import type { RecordList } from "./api.js";
import {
  buildDatasetEntityItems,
  buildEditEntityItems,
  buildUserEntityItems,
} from "./entity-opener-items.js";

const listing: RecordList = {
  ok: true,
  kinds: [],
  records: [
    { kind: "content", id: "home", title: "Home" },
    { kind: "content", id: "about", title: "About" },
    { kind: "content", id: "post-1", type: "article", parentId: "news", title: "First post" },
    { kind: "content", id: "post-2", type: "article", parentId: "news", title: "Second post" },
    { kind: "content", id: "news", type: "blog", title: "News" },
    { kind: "content", id: "other", type: "blog", title: "Other blog" },
    { kind: "layouts", id: "master" },
    { kind: "layouts", id: "article" },
    { kind: "items", id: "footer" },
  ],
};

describe("buildEditEntityItems", () => {
  it("lists other pages when editing a page", async () => {
    const items = await buildEditEntityItems("content", "home", { type: "page" }, listing);
    expect(items.map((i) => i.id).sort()).toEqual(["about"]);
    expect(items.every((i) => i.hash.startsWith("#/content/"))).toBe(true);
  });

  it("lists other articles in the same blog", async () => {
    const items = await buildEditEntityItems(
      "content",
      "post-1",
      { type: "article", parentId: "news" },
      listing,
    );
    expect(items.map((i) => i.id)).toEqual(["post-2"]);
  });

  it("lists other blogs when editing a blog", async () => {
    const items = await buildEditEntityItems("content", "news", { type: "blog" }, listing);
    expect(items.map((i) => i.id)).toEqual(["other"]);
  });

  it("lists other layouts by id", async () => {
    const items = await buildEditEntityItems("layouts", "master", undefined, listing);
    expect(items.map((i) => i.id)).toEqual(["article"]);
    expect(items[0]?.label).toBe("article");
  });
});

describe("buildDatasetEntityItems", () => {
  it("excludes the current dataset", () => {
    const items = buildDatasetEntityItems(
      [
        { id: "a", title: "Alpha", recordCount: 1, invalidCount: 0 },
        { id: "b", title: "Beta", recordCount: 2, invalidCount: 0 },
      ],
      "a",
    );
    expect(items.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("buildUserEntityItems", () => {
  it("excludes the current user", () => {
    const items = buildUserEntityItems(["bob", "alice", "carol"], "bob");
    expect(items.map((i) => i.id)).toEqual(["alice", "carol"]);
  });
});
