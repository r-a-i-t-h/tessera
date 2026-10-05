import { describe, expect, it } from "vitest";
import { authoredPageToPage, pageToAuthoring } from "../src/site/document.js";

describe("page authoring", () => {
  it("keeps a page frame through the authoring round trip", () => {
    const page = authoredPageToPage({
      id: "events",
      title: "Events",
      masterLayoutId: "events-frame",
      zones: {},
    });
    expect(page.masterLayoutId).toBe("events-frame");
    expect(pageToAuthoring(page).masterLayoutId).toBe("events-frame");
    const plain = pageToAuthoring(authoredPageToPage({ id: "about", title: "About" }));
    expect(plain.masterLayoutId).toBeUndefined();
  });
});
