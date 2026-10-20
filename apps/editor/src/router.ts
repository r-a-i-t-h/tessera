export type Route =
  | { page: "home" }
  | { page: "pages" }
  | { page: "articles"; blog?: string }
  | { page: "records"; kind?: string }
  | { page: "library"; id: string | null }
  | { page: "maintenance"; tab?: string }
  | { page: "backups" }
  | { page: "styles"; sheet?: string }
  | { page: "guide" }
  | { page: "account" }
  | { page: "users" }
  | { page: "user"; username: string }
  | { page: "edit"; kind: string; id: string }
  | { page: "missing" };

function hashPathAndQuery(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#\/?/, "");
  const qIdx = raw.indexOf("?");
  if (qIdx === -1) return { path: raw, query: new URLSearchParams() };
  return { path: raw.slice(0, qIdx), query: new URLSearchParams(raw.slice(qIdx + 1)) };
}

/** Hash route to the Styles page with a sheet editor maximized. */
export function stylesSheetHref(sheetId: string): string {
  return `#/styles?sheet=${encodeURIComponent(sheetId)}`;
}

/** Hash route to the Guide with a section scrolled into view. */
export function guideSectionHref(sectionId: string): string {
  return `#/guide?section=${encodeURIComponent(sectionId)}`;
}

function locationHash(): string {
  return typeof window !== "undefined" ? window.location.hash : "";
}

/** Section id from `#/guide?section=…`. */
export function guideSectionQuery(hash?: string): string | undefined {
  const { path, query } = hashPathAndQuery(hash ?? locationHash());
  if (path !== "guide") return undefined;
  const section = query.get("section")?.trim();
  return section || undefined;
}

/** Stylesheet id from `#/styles?sheet=…` or `?sheet=…` on the page URL. */
export function stylesSheetQuery(hash?: string): string | undefined {
  const { query: hashQuery } = hashPathAndQuery(hash ?? locationHash());
  const fromHash = hashQuery.get("sheet")?.trim();
  if (fromHash) return fromHash;
  if (typeof window === "undefined") return undefined;
  const fromSearch = new URLSearchParams(window.location.search).get("sheet")?.trim();
  return fromSearch || undefined;
}

export function parseRoute(hash: string): Route {
  const { path, query } = hashPathAndQuery(hash);
  if (!path) return { page: "home" };
  const slash = path.indexOf("/");
  const head = decodeURIComponent(slash === -1 ? path : path.slice(0, slash));
  const rest = slash === -1 ? "" : decodeURIComponent(path.slice(slash + 1));
  if (head === "pages") return rest ? { page: "missing" } : { page: "pages" };
  if (head === "articles") {
    if (rest.includes("/")) return { page: "missing" };
    return { page: "articles", blog: rest || undefined };
  }
  if (head === "records") {
    if (rest.includes("/")) return { page: "missing" };
    return { page: "records", kind: rest || undefined };
  }
  if (head === "site" || head === "nav") {
    if (!rest || rest.includes("/")) return { page: "missing" };
    return { page: "records", kind: head };
  }
  if (head === "library") return { page: "library", id: rest || null };
  if (head === "maintenance") {
    if (rest.includes("/")) return { page: "missing" };
    return { page: "maintenance", tab: rest || undefined };
  }
  if (head === "backups") return rest ? { page: "missing" } : { page: "backups" };
  if (head === "styles") {
    if (rest) return { page: "missing" };
    const sheet = query.get("sheet")?.trim();
    return sheet ? { page: "styles", sheet } : { page: "styles" };
  }
  if (head === "guide") return rest ? { page: "missing" } : { page: "guide" };
  if (head === "account") return rest ? { page: "missing" } : { page: "account" };
  if (head === "users") {
    if (!rest) return { page: "users" };
    if (rest.includes("/")) return { page: "missing" };
    return { page: "user", username: rest };
  }
  if (!rest || rest.includes("/")) return { page: "missing" };
  return { page: "edit", kind: head, id: rest };
}
