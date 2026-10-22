/**
 * Left to right / top to bottom: the assembled site, then the layers under it.
 * A layout declares the zones. A type picks one. Items fill those zones, and a
 * binding mounts a component on that fill. A template is a page body copied into
 * content. Site names the home page and the layouts. Navigation is top-level in the editor
 * (after Records, before Pages). Blogs (the record type) sits with Records; individual blogs
 * expand under Articles.
 */
export const RECORD_NAV_ITEMS: { kind: string; label: string }[] = [
  { kind: "site", label: "Site" },
  { kind: "blogs", label: "Blogs" },
  { kind: "templates", label: "Templates" },
  { kind: "bindings", label: "Bindings" },
  { kind: "items", label: "Items" },
  { kind: "types", label: "Types" },
  { kind: "layouts", label: "Layouts" },
];

export const RECORD_TAB_ORDER = RECORD_NAV_ITEMS.map((item) => item.kind);
