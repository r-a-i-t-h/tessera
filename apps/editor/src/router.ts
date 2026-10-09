export type Route =
  | { page: "home" }
  | { page: "pages" }
  | { page: "articles"; tenant?: string }
  | { page: "records"; kind?: string }
  | { page: "library"; id: string | null }
  | { page: "backups" }
  | { page: "styles" }
  | { page: "guide" }
  | { page: "account" }
  | { page: "users" }
  | { page: "user"; username: string }
  | { page: "edit"; kind: string; id: string }
  | { page: "missing" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  if (!path) return { page: "home" };
  const slash = path.indexOf("/");
  const head = decodeURIComponent(slash === -1 ? path : path.slice(0, slash));
  const rest = slash === -1 ? "" : decodeURIComponent(path.slice(slash + 1));
  if (head === "pages") return rest ? { page: "missing" } : { page: "pages" };
  if (head === "articles") {
    if (rest.includes("/")) return { page: "missing" };
    return { page: "articles", tenant: rest || undefined };
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
  if (head === "backups") return rest ? { page: "missing" } : { page: "backups" };
  if (head === "styles") return rest ? { page: "missing" } : { page: "styles" };
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
