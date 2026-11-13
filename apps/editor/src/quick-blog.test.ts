import { describe, expect, it } from "vitest";
import type { RecordList } from "./api.js";
import { appendTagToInput, collectArticleTags, topAuthorForBlog } from "./quick-blog.js";

function article(
  id: string,
  extra: { parentId?: string; author?: string; tags?: string[] } = {},
): RecordList["records"][number] {
  return {
    kind: "content",
    id,
    type: "article",
    ...extra,
  };
}

describe("quick blog helpers", () => {
  it("collects sorted unique tags from articles", () => {
    const listing: RecordList = {
      ok: true,
      kinds: [],
      records: [
        article("a", { tags: ["news", "beta"] }),
        article("b", { tags: ["news", "release"] }),
      ],
    };
    expect(collectArticleTags(listing)).toEqual(["beta", "news", "release"]);
  });

  it("picks the most common author on a blog with alphabetical ties", () => {
    const listing: RecordList = {
      ok: true,
      kinds: [],
      records: [
        article("a", { parentId: "blog", author: "Zed" }),
        article("b", { parentId: "blog", author: "Amy" }),
        article("c", { parentId: "blog", author: "Amy" }),
        article("d", { parentId: "blog", author: "Zed" }),
        article("e", { parentId: "other", author: "Bob" }),
      ],
    };
    expect(topAuthorForBlog(listing, "blog")).toBe("Amy");
    expect(topAuthorForBlog(listing, "empty")).toBe("");
  });

  it("appends tags without duplicates", () => {
    expect(appendTagToInput("alpha, Beta", "beta")).toBe("alpha, Beta");
    expect(appendTagToInput("alpha", "Beta")).toBe("alpha, Beta");
    expect(appendTagToInput("", "solo")).toBe("solo");
  });
});
