import { describe, expect, it } from "vitest";
import { newPageBody, pageIdError, withSidebarLink } from "./page.js";

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
