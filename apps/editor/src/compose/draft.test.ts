import { describe, expect, it } from "vitest";
import { draftYaml, parsePageYaml, withZoneHtml } from "./draft.js";

describe("parsePageYaml", () => {
  it("reads a page mapping and rejects a broken file", () => {
    const parsed = parsePageYaml("id: home\ntitle: Home\nzones:\n  main:\n    html: <p>Hi</p>\n");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({ id: "home", title: "Home" });
    expect(parsePageYaml("title: [").ok).toBe(false);
    expect(parsePageYaml("- just a list\n").ok).toBe(false);
  });
});

describe("withZoneHtml", () => {
  it("writes canvas HTML and leaves JSON zones alone", () => {
    const next = withZoneHtml(
      {
        id: "home",
        zones: {
          main: { html: "<p>Old</p>" },
          meta: { json: { role: "host" } },
        },
      },
      { main: "<h2>New</h2>", meta: "<p>nope</p>", aside: "<p>Aside</p>" },
    );
    expect(next.zones).toEqual({
      main: { html: "<h2>New</h2>" },
      meta: { json: { role: "host" } },
      aside: { html: "<p>Aside</p>" },
    });
  });
});

describe("draftYaml", () => {
  it("round-trips a page through YAML", () => {
    const page = { id: "home", title: "Home", zones: { main: { html: "<p>Hi</p>" } } };
    const parsed = parsePageYaml(draftYaml(page));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual(page);
  });
});
