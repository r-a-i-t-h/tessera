/** Same rule as the editor API record id (`RECORD_ID`). */
export const PAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type NewPageBody = {
  id: string;
  title: string;
  zones: {
    main: { blocks: [] };
  };
};

export type CreatedPage = {
  id: string;
  title: string;
  templateId: string;
  locked?: true;
  type?: string;
  fields?: Record<string, string>;
  tags?: string[];
  includes?: string[];
  zones: {
    main: { blocks: unknown[] };
  } & Record<string, unknown>;
};

export type TemplateSource = {
  isLocked?: unknown;
  type?: unknown;
  fields?: unknown;
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

/** Default id for a duplicate when the author does not pick one. */
export function suggestDuplicateId(id: string, existingIds: readonly string[]): string {
  const base = `${id}-copy`;
  if (!existingIds.includes(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${id}-copy-${n}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${id}-copy-${Date.now()}`;
}

/** A first version of a page: metadata title plus an empty body canvas. */
export function newPageBody(id: string, title: string): NewPageBody {
  const pageId = id.trim();
  const name = title.trim() || pageId;
  return {
    id: pageId,
    title: name,
    zones: {
      main: { blocks: [] },
    },
  };
}

/** A prototype page. Compose fills `main`. It is not published. */
export function newTemplateBody(id: string): { id: string; zones: { main: { blocks: [] } } } {
  return {
    id: id.trim(),
    zones: { main: { blocks: [] } },
  };
}

/**
 * Copy a template into a new page.
 * Every zone, plus tags and includes, travels with the page.
 * `locked` is set only when the template says so.
 */
export function pageFromTemplate(id: string, title: string, templateId: string, template: TemplateSource): CreatedPage {
  const page = newPageBody(id, title);
  const created: CreatedPage = {
    id: page.id,
    title: page.title,
    templateId,
    zones: zonesFromTemplate(template),
  };
  const tags = stringList(template.tags);
  if (tags) created.tags = tags;
  const includes = stringList(template.includes);
  if (includes) created.includes = includes;
  const type = typeof template.type === "string" ? template.type.trim() : "";
  if (type) created.type = type;
  const fields = stringFields(template.fields);
  if (fields) created.fields = fields;
  if (template.isLocked === true) created.locked = true;
  return created;
}

function zonesFromTemplate(template: TemplateSource): CreatedPage["zones"] {
  const zones: Record<string, unknown> = {
    main: { blocks: [] },
  };
  const source = template.zones;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return zones as CreatedPage["zones"];
  }
  for (const [name, zone] of Object.entries(source)) {
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) continue;
    zones[name] = structuredClone(zone);
  }
  if (!("main" in zones)) zones.main = { blocks: [] };
  return zones as CreatedPage["zones"];
}

function stringFields(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const fields: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") fields[key] = item;
  }
  return Object.keys(fields).length ? fields : undefined;
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
