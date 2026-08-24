import type { SiteDocument } from "@r-a-i-t-h/tessera-model";

/** Minimal fixture: two layouts (with/without aside), shared item, media, nav. */
export function makeFixtureDoc(): SiteDocument {
  return {
    version: 1,
    site: {
      id: "test",
      title: "Test site",
      homePageId: "home",
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
            { type: "zone", id: "aside" },
            { type: "zone", id: "footer" },
          ],
        },
      },
      {
        id: "no-aside",
        root: {
          type: "region",
          role: "main",
          children: [
            { type: "zone", id: "title" },
            { type: "zone", id: "main" },
            { type: "zone", id: "footer" },
          ],
        },
      },
    ],
    items: [
      {
        id: "shared-footer",
        zones: {
          footer: [{ type: "text", html: "<p>Shared footer</p>" }],
        },
      },
      {
        id: "promo",
        zones: {
          aside: [{ type: "text", html: "<p>Promo aside</p>" }],
        },
      },
    ],
    pages: [
      {
        id: "home",
        title: "Home",
        layoutId: "with-aside",
        tags: ["page"],
        includes: ["shared-footer", "promo"],
        zones: {
          title: [{ type: "text", html: "Home title" }],
          main: [
            { type: "text", html: "<p>Hello</p>" },
            { type: "component", name: "greet", props: { name: "world" } },
            { type: "media", id: "pic" },
            { type: "component", name: "eventList", props: { fromZone: "events" } },
          ],
          events: [
            {
              type: "json",
              data: [
                { title: "Alpha" },
                { title: "Beta" },
              ],
            },
          ],
          aside: [{ type: "text", html: "<p>Page aside</p>" }],
        },
      },
      {
        id: "hidden-aside",
        title: "Hidden aside",
        layoutId: "no-aside",
        tags: ["page"],
        includes: ["shared-footer", "promo"],
        zones: {
          title: [{ type: "text", html: "No aside layout" }],
          main: [{ type: "text", html: "<p>Body</p>" }],
          aside: [{ type: "text", html: "<p>Should not show</p>" }],
        },
      },
      {
        id: "about",
        title: "About",
        layoutId: "with-aside",
        includes: ["shared-footer"],
        zones: {
          title: [{ type: "text", html: "About" }],
          main: [{ type: "text", html: "<p>About body</p>" }],
        },
      },
    ],
    media: [
      {
        id: "pic",
        title: "Local pic",
        url: "./media/sample.svg",
        type: "image",
        alt: "Sample",
      },
      {
        id: "rooted",
        title: "Root absolute",
        url: "/media/rooted.svg",
        type: "image",
      },
    ],
    nav: [
      { sidebar: true, heading: "Pages" },
      { sidebar: true, id: "home", title: "Home" },
      { sidebar: true, id: "hidden-aside", title: "Hidden" },
      { sidebar: true, id: "about", title: "About" },
    ],
  };
}
