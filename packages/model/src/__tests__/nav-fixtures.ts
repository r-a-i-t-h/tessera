import type { SiteDocument } from "../schema.js";

/** Minimal site for nav-expand tests. */
export function makeFixtureDoc(): SiteDocument {
  return {
    version: 2,
    site: {
      id: "test",
      title: "Test site",
      homePageId: "home",
      defaultLayoutId: "with-aside",
    },
    layouts: [
      {
        id: "with-aside",
        root: {
          type: "region",
          role: "main",
          children: [
            { type: "zone", id: "title" },
            { type: "zone", id: "main" },
          ],
        },
      },
    ],
    items: [],
    pages: [
      {
        id: "home",
        title: "Home",
        zones: { title: [{ type: "text", html: "Home" }], main: [] },
      },
      {
        id: "about",
        title: "About",
        zones: { title: [{ type: "text", html: "About" }], main: [] },
      },
    ],
    media: [],
    folders: [],
    nav: [
      { sidebar: true, heading: "Pages" },
      { sidebar: true, id: "home", title: "Home" },
      { sidebar: true, id: "about", title: "About" },
    ],
    bindings: [],
    types: [],
  };
}
