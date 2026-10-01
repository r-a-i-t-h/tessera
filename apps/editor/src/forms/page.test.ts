import { describe, expect, it } from "vitest";
import { newPageBody, newTemplateBody, pageFromTemplate, pageIdError, withSidebarLink } from "./page.js";

describe("new page", () => {
  it("accepts a fresh id and rejects blanks, punctuation, and duplicates", () => {
    expect(pageIdError("about", ["home"])).toBeUndefined();
    expect(pageIdError("  events.2026 ", ["home"])).toBeUndefined();
    expect(pageIdError("  ", [])).toMatch(/id/i);
    expect(pageIdError("-nope", [])).toMatch(/letter or number/);
    expect(pageIdError("home", ["home"])).toMatch(/already exists/);
  });

  it("writes a title zone and an empty body", () => {
    expect(newPageBody(" about ", " About us ")).toEqual({
      id: "about",
      title: "About us",
      zones: {
        title: { html: "About us" },
        main: { html: "" },
      },
    });
    expect(newPageBody("cafe", "Tom & <Jerry>")).toEqual({
      id: "cafe",
      title: "Tom & <Jerry>",
      zones: {
        title: { html: "Tom &amp; &lt;Jerry&gt;" },
        main: { html: "" },
      },
    });
  });

  it("starts a template as an empty prototype body", () => {
    expect(newTemplateBody(" animal ")).toEqual({
      id: "animal",
      zones: { main: { html: "" } },
    });
  });

  it("copies a template body onto a page and locks it when the template says so", () => {
    expect(
      pageFromTemplate("daisy", "Daisy", "animal", {
        isLocked: true,
        type: " animal ",
        zones: { main: { html: "<h2>Animal name</h2><p>Where it lives.</p>" } },
      }),
    ).toEqual({
      id: "daisy",
      title: "Daisy",
      templateId: "animal",
      locked: true,
      type: "animal",
      zones: {
        title: { html: "Daisy" },
        main: { html: "<h2>Animal name</h2><p>Where it lives.</p>" },
      },
    });
  });

  it("copies tags, includes, and zones other than the title", () => {
    expect(
      pageFromTemplate("priya", "Priya Nair", "person", {
        isLocked: true,
        type: "person",
        tags: ["trustee"],
        includes: ["common-footer"],
        fields: { role: "", email: "" },
        zones: {
          title: { html: "Sample person" },
          main: { html: "<p>About them.</p>" },
        },
      }),
    ).toEqual({
      id: "priya",
      title: "Priya Nair",
      templateId: "person",
      locked: true,
      type: "person",
      tags: ["trustee"],
      includes: ["common-footer"],
      fields: { role: "", email: "" },
      zones: {
        title: { html: "Priya Nair" },
        main: { html: "<p>About them.</p>" },
      },
    });
  });

  it("leaves a page unlocked when the template is only a blueprint", () => {
    const page = pageFromTemplate("note", "Note", "free", {
      isLocked: false,
      zones: { main: { html: "<p>Start here.</p>" } },
    });
    expect(page.locked).toBeUndefined();
    expect(page.type).toBeUndefined();
    expect(page.zones.main.html).toBe("<p>Start here.</p>");
  });

  it("appends a sidebar link and leaves a non-list nav alone", () => {
    const nav = [{ id: "home", title: "Home", sidebar: true }];
    const linked = withSidebarLink(nav, "about", "About");
    expect(linked).toEqual({
      ok: true,
      nav: [
        { id: "home", title: "Home", sidebar: true },
        { id: "about", title: "About", sidebar: true },
      ],
    });
    expect(nav).toHaveLength(1);
    expect(withSidebarLink({ id: "home" }, "about", "About")).toEqual({
      ok: false,
      message: "Navigation is not a list, so this page was not added to the sidebar.",
    });
  });
});
