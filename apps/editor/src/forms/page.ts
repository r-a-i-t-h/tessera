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

export type CreatedPage = {
  id: string;
  title: string;
  templateId: string;
  locked?: true;
  layoutId?: string;
  tags?: string[];
  includes?: string[];
  zones: {
    title: { html: string };
    main: { html: string };
  } & Record<string, unknown>;
};

export type TemplateSource = {
  isLocked?: unknown;
  layoutId?: unknown;
  tags?: unknown;
  includes?: unknown;
  zones?: unknown;
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

/** A prototype page. Compose fills `main`. It is not published. */
export function newTemplateBody(id: string, title: string): { id: string; title: string; zones: { main: { html: string } } } {
  const templateId = id.trim();
  const name = title.trim() || templateId;
  return {
    id: templateId,
    title: name,
    zones: { main: { html: "" } },
  };
}

/**
 * Copy a template into a new page. The title zone is the new page's title.
 * Every other zone, plus tags and includes, travels with the page.
 * `locked` is set only when the template says so.
 */
export function pageFromTemplate(id: string, title: string, templateId: string, template: TemplateSource): CreatedPage {
  const page = newPageBody(id, title);
  const created: CreatedPage = {
    id: page.id,
    title: page.title,
    templateId,
    zones: zonesFromTemplate(template, page.zones.title.html),
  };
  const tags = stringList(template.tags);
  if (tags) created.tags = tags;
  const includes = stringList(template.includes);
  if (includes) created.includes = includes;
  const layoutId = typeof template.layoutId === "string" ? template.layoutId.trim() : "";
  if (layoutId) created.layoutId = layoutId;
  if (template.isLocked === true) created.locked = true;
  return created;
}

function zonesFromTemplate(template: TemplateSource, titleHtml: string): CreatedPage["zones"] {
  const zones: Record<string, unknown> = {
    title: { html: titleHtml },
    main: { html: "" },
  };
  const source = template.zones;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return zones as CreatedPage["zones"];
  }
  for (const [name, zone] of Object.entries(source)) {
    if (name === "title") continue;
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) continue;
    zones[name] = structuredClone(zone);
  }
  return zones as CreatedPage["zones"];
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
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
