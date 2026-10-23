import type { Route } from "./router.js";

export type RestrictAccessLevel = "editor";

const LIMITED_EDITOR_EDIT_KINDS = new Set(["content", "nav"]);

export function isFullAdmin(user: { restrictAccessLevel?: RestrictAccessLevel }): boolean {
  return user.restrictAccessLevel !== "editor";
}

export function isLimitedEditor(user: { restrictAccessLevel?: RestrictAccessLevel }): boolean {
  return user.restrictAccessLevel === "editor";
}

export function routeAllowedForUser(route: Route, user: { restrictAccessLevel?: RestrictAccessLevel }): boolean {
  if (isFullAdmin(user)) return true;
  switch (route.page) {
    case "records":
    case "runtime-modules":
    case "styles":
    case "users":
    case "user":
    case "backups":
      return false;
    case "edit":
      return LIMITED_EDITOR_EDIT_KINDS.has(route.kind);
    default:
      return true;
  }
}
