import { describe, expect, it } from "vitest";
import { expandMustache } from "../bindings.js";
import { htmlEmbed } from "../builtins/html-embed.js";
import { createDefaultRegistry } from "../default-registry.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("htmlEmbed", () => {
  it("returns props.html unchanged, including script tags", () => {
    const snippet = `<div id="pay"></div><script src="https://example.com/widget.js"></script>`;
    expect(htmlEmbed({} as RenderContext, { html: snippet })).toBe(snippet);
    expect(htmlEmbed({} as RenderContext, {})).toBe("");
  });

  it("expands through a binding token", () => {
    const doc = makeFixtureDoc();
    doc.bindings = [
      {
        id: "tickets",
        component: "htmlEmbed",
        props: { html: "<iframe title=\"Tickets\"></iframe>" },
      },
    ];
    const ctx: RenderContext = {
      document: doc,
      page: doc.pages[0]!,
      profile: { layoutId: "with-aside", layoutSource: "site" },
      zones: new Map(),
      registry: createDefaultRegistry(),
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml: (s) => s,
    };
    expect(expandMustache("<section>{{tickets}}</section>", ctx)).toBe(
      "<section><iframe title=\"Tickets\"></iframe></section>",
    );
  });
});
