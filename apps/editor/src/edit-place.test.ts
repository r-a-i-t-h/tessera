import { describe, expect, it } from "vitest";
import { editPlace } from "./edit-place.js";

describe("editPlace", () => {
  it("keeps a page in Pages", () => {
    expect(editPlace("content", "home", { id: "home", title: "Home" })).toEqual({
      section: "pages",
      back: "#/pages",
      heading: "Home",
    });
  });

  it("returns an article to its tenant", () => {
    expect(
      editPlace("content", "fair", {
        id: "fair",
        title: "Summer fair",
        type: "article",
        fields: { tenant: "hall" },
      }),
    ).toEqual({
      section: "articles",
      back: "#/articles/hall",
      heading: "Summer fair",
    });
  });

  it("returns a blog to Records → Blogs", () => {
    expect(editPlace("content", "news", { id: "news", title: "News", type: "blog" })).toEqual({
      section: "records",
      back: "#/records/blogs",
      heading: "News",
    });
  });

  it("keeps other records on their list", () => {
    expect(editPlace("layouts", "master", { id: "master" })).toEqual({
      section: "records",
      back: "#/records/layouts",
      heading: "layouts / master",
    });
  });
});
