import { describe, expect, it } from "vitest";
import {
  extractSearchDocuments,
  loadSearchEngine,
  MIN_SEARCH_QUERY_LENGTH,
  runSearch,
  searchIndexPayload,
  stripHtmlToText,
  textFragmentDirective,
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

  it("returns body on hits and ignores queries shorter than the minimum", () => {
    const doc = makeFixtureDoc();
    const about = doc.pages.find((p) => p.id === "about");
    if (about) {
      about.zones = {
        main: [{ type: "text", html: "<p>Something about willow trees.</p>" }],
      };
    }
    const mini = loadSearchEngine(searchIndexPayload(doc));
    expect(runSearch(mini, { query: "wi" })).toEqual([]);
    expect(runSearch(mini, { query: "wil" }).length).toBeGreaterThanOrEqual(1);
    const hit = runSearch(mini, { query: "willow" })[0];
    expect(hit?.body).toContain("willow");
    expect(MIN_SEARCH_QUERY_LENGTH).toBe(3);
  });
});

describe("textFragmentDirective", () => {
  it("builds a prefix-aware fragment from body text", () => {
    const fragment = textFragmentDirective("will", {
      title: "Home",
      body: "Welcome to the garden with willow trees nearby.",
    });
    expect(fragment).toMatch(/^#:~:text=/);
    expect(fragment).toContain("willow");
    expect(fragment).not.toContain("#about");
  });

  it("percent-encodes hyphens inside fragment text", () => {
    const fragment = textFragmentDirective("beta", {
      title: "T",
      body: "alpha beta-gamma delta",
    });
    expect(fragment).toContain("beta%2Dgamma");
  });

  it("falls back to title when body has no match", () => {
    const fragment = textFragmentDirective("willow", {
      title: "Willow home page",
      body: "Unrelated prose.",
    });
    expect(fragment).toContain("Willow");
  });

  it("returns empty when no passage matches", () => {
    expect(
      textFragmentDirective("zzz", { title: "Home", body: "Hello world." }),
    ).toBe("");
  });

  it("highlights only the best matching word, not a span through filler", () => {
    const fragment = textFragmentDirective("will", {
      title: "Home",
      body: "Welcome to the garden with willow trees nearby.",
    });
    expect(fragment).toContain("willow");
    expect(fragment).not.toMatch(/Welcome/i);
  });

  it("uses separate text directives for multi-term queries", () => {
    const fragment = textFragmentDirective("garden will", {
      title: "Home",
      body: "Welcome to the garden with willow trees nearby.",
    });
    expect(fragment).toContain("&text=");
    expect(fragment).toContain("garden");
    expect(fragment).toContain("willow");
    expect(fragment).not.toContain("with");
  });
});
