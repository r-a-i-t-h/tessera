/** Same rule as the editor API record id (`RECORD_ID`). */
export const PAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type NewPageBody = {
  id: string;
  title: string;
  zones: {
    title: { html: string };
    main: { html: string };
  };
};

export type SidebarLinkResult =
  | { ok: true; nav: unknown[] }
  | { ok: false; message: string };

export function pageIdError(id: string, existingIds: readonly string[]): string | undefined {
  const trimmed = id.trim();
  if (!trimmed) return "Enter an id.";
  if (!PAGE_ID.test(trimmed)) {
    return "Id must start with a letter or number, then only letters, numbers, dots, hyphens, or underscores.";
  }
  if (existingIds.includes(trimmed)) return `A page with id ${trimmed} already exists.`;
  return undefined;
}

/** A first version of a page: title zone plus an empty body, matching a blank home page. */
export function newPageBody(id: string, title: string): NewPageBody {
  const pageId = id.trim();
  const name = title.trim() || pageId;
  return {
    id: pageId,
    title: name,
    zones: {
      title: { html: escapeText(name) },
      main: { html: "" },
    },
  };
}

/**
 * Append a sidebar link. A nav file that is not a list is left unchanged.
 */
export function withSidebarLink(nav: unknown, id: string, title: string): SidebarLinkResult {
  if (!Array.isArray(nav)) {
    return {
      ok: false,
      message: "Navigation is not a list, so this page was not added to the sidebar.",
    };
  }
  const name = title.trim() || id;
  return { ok: true, nav: [...nav, { id, title: name, sidebar: true }] };
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
