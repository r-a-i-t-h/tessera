import { describe, expect, it } from "vitest";
import {
  extractSearchDocuments,
  loadSearchEngine,
  runSearch,
  searchIndexPayload,
  stripHtmlToText,
} from "../search-index.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("stripHtmlToText", () => {
  it("removes tags and collapses space", () => {
    expect(stripHtmlToText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });
});

describe("search index", () => {
  it("indexes titles and bodies and ranks title hits higher", () => {
    const doc = makeFixtureDoc();
    const about = doc.pages.find((p) => p.id === "about");
    if (about) {
      about.zones = {
        main: [{ type: "text", html: "<p>Something about willow trees.</p>" }],
      };
    }
    const home = doc.pages.find((p) => p.id === "home");
    if (home) {
      home.title = "Willow home";
      home.zones = { main: [{ type: "text", html: "<p>Welcome.</p>" }] };
    }

    const payload = searchIndexPayload(doc);
    expect(payload.version).toBe(1);
    expect(payload.facets).toBeDefined();
    const mini = loadSearchEngine(payload);
    const hits = runSearch(mini, { query: "willow" });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]?.id).toBe("home");
  });

  it("extracts path and tags for documents", () => {
    const doc = makeFixtureDoc();
    const about = doc.pages.find((p) => p.id === "about");
    if (about) about.tags = ["garden"];
    const docs = extractSearchDocuments(doc);
    const row = docs.find((d) => d.id === "about");
    expect(row?.tagList).toEqual(["garden"]);
    expect(row?.path).toBe("about");
  });
});
