import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  buildPageLinkGraph,
  collectPageRefIds,
  pageLinksFor,
} from "../page-link-graph.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("collectPageRefIds", () => {
  it("extracts data-tessera-page ids", () => {
    expect(
      collectPageRefIds(
        `<p>See <a data-tessera-page="hall" href="#">Hall</a> and <a data-tessera-page='tower' href="#">Tower</a>.</p>`,
      ),
    ).toEqual(["hall", "tower"]);
  });

  it("returns empty when none", () => {
    expect(collectPageRefIds("<p>No links</p>")).toEqual([]);
  });
});

describe("buildPageLinkGraph", () => {
  function docWithLinks(): SiteDocument {
    const base = makeFixtureDoc();
    return {
      ...base,
      items: [
        ...base.items,
        {
          id: "cross-item",
          zones: {
            aside: [
              {
                type: "text",
                html: `<p>Also <a data-tessera-page="about" href="#">About</a>.</p>`,
              },
            ],
          },
        },
      ],
      pages: [
        {
          id: "home",
          title: "Home",
          includes: ["cross-item"],
          zones: {
            main: [
              {
                type: "text",
                html: `<p>Go <a data-tessera-page="gone" href="#">missing</a> or <a data-tessera-page="home" href="#">self</a>.</p>`,
              },
            ],
          },
        },
        {
          id: "about",
          title: "About",
          zones: {
            main: [
              {
                type: "text",
                html: `<p>Back <a data-tessera-page="home" href="#">Home</a>.</p>`,
              },
            ],
          },
        },
        {
          id: "orphan",
          title: "Orphan",
          zones: {
            main: [{ type: "text", html: "<p>No links</p>" }],
          },
        },
      ],
    };
  }

  it("builds outgoing and incoming edges", () => {
    const graph = buildPageLinkGraph(docWithLinks());
    expect(graph.outgoing.get("home")).toEqual(["about", "gone"]);
    expect(graph.outgoing.get("about")).toEqual(["home"]);
    expect(graph.outgoing.get("orphan")).toEqual([]);
    expect(graph.incoming.get("home")).toEqual(["about"]);
    expect(graph.incoming.get("about")).toEqual(["home"]);
    expect(graph.incoming.get("orphan")).toEqual([]);
  });

  it("omits self-links", () => {
    const graph = buildPageLinkGraph(docWithLinks());
    expect(graph.outgoing.get("home")).not.toContain("home");
  });

  it("attributes item links to the including page", () => {
    const graph = buildPageLinkGraph(docWithLinks());
    // home has no direct about link; cross-item supplies about
    expect(graph.outgoing.get("home")).toContain("about");
    expect(graph.incoming.get("about")).toEqual(["home"]);
  });

  it("pageLinksFor resolves titles and missing", () => {
    const document = docWithLinks();
    const links = pageLinksFor(buildPageLinkGraph(document), "home", document);
    expect(links.linkedTo).toEqual([
      { id: "about", title: "About" },
      { id: "gone", missing: true },
    ]);
    expect(links.linkedFrom).toEqual([{ id: "about", title: "About" }]);
  });
});
