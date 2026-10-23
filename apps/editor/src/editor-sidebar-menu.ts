import type { EditorNavContext, EditorSection } from "./chrome.js";

export type SidebarLinkActive =
  | { recordsKind: string }
  | { section: EditorSection };

export type SidebarLink = {
  label: string;
  href: string;
  whenActive?: SidebarLinkActive;
};

export type SidebarGroup = {
  groupLabel: string;
  ariaLabel: string;
  items: SidebarLink[];
};

/** Sidebar Setup group — presentation only; not derived from API record kinds. */
export const SETUP_MENU: SidebarGroup = {
  groupLabel: "Setup",
  ariaLabel: "Setup",
  items: [
    { label: "Site", href: "#/records/site", whenActive: { recordsKind: "site" } },
    { label: "Layouts", href: "#/records/layouts", whenActive: { recordsKind: "layouts" } },
    { label: "Types", href: "#/records/types", whenActive: { recordsKind: "types" } },
    { label: "Templates", href: "#/records/templates", whenActive: { recordsKind: "templates" } },
    { label: "Items", href: "#/records/items", whenActive: { recordsKind: "items" } },
    { label: "Blogs", href: "#/records/blogs", whenActive: { recordsKind: "blogs" } },
    { label: "Datasets", href: "#/records/datasets", whenActive: { recordsKind: "datasets" } },
    { label: "Bindings", href: "#/records/bindings", whenActive: { recordsKind: "bindings" } },
    {
      label: "Runtime modules",
      href: "#/records/runtimeModules",
      whenActive: { recordsKind: "runtimeModules" },
    },
  ],
};

/** Sidebar Admin group — presentation only. */
export const ADMIN_MENU: SidebarGroup = {
  groupLabel: "Admin",
  ariaLabel: "Admin",
  items: [
    { label: "Users", href: "#/users", whenActive: { section: "users" } },
    { label: "Maintenance", href: "#/maintenance", whenActive: { section: "maintenance" } },
    { label: "Backups", href: "#/backups", whenActive: { section: "backups" } },
  ],
};

export function isSidebarLinkCurrent(
  whenActive: SidebarLinkActive | undefined,
  section: EditorSection,
  nav: EditorNavContext,
): boolean {
  if (!whenActive) return false;
  if ("recordsKind" in whenActive) return nav.recordsKind === whenActive.recordsKind;
  return section === whenActive.section;
}
