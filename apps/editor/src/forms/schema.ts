export type FieldType = "string" | "number" | "date" | "Checkbox" | "SingleSelect" | "yaml";

export type SelectOption = { value: string; label: string };

export type FieldSchema = {
  name: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  readOnly?: boolean;
  required?: boolean;
  /** Shown when the stored value is missing. */
  defaultValue?: string;
  /**
   * SingleSelect: when the stored value is a non-empty string not in `options`,
   * select this option value instead (e.g. retain-orphan sentinel).
   */
  selectIfUnknown?: string;
  /** Checkbox: missing means checked. Checking again omits the key; unchecking writes false. */
  defaultChecked?: boolean;
  /** String stored as a comma-separated list. */
  list?: boolean;
  inputType?: "text" | "url";
  rows?: number;
};

/** Form value meaning "keep the stored aspectId" — not a valid AspectIdSchema id. */
export const ASPECT_NO_CHANGE = "__non_theme__";

export type FormSchema = {
  fields: FieldSchema[];
};

export const SITE_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "title", label: "Title", type: "string", required: true },
    { name: "homePageId", label: "Home page", type: "string", required: true },
    { name: "defaultLayoutId", label: "Default layout", type: "string" },
    { name: "masterLayoutId", label: "Master layout", type: "string" },
    { name: "defaultAspectId", label: "Default aspect", type: "string" },
    {
      name: "delivery",
      label: "Flavour",
      type: "SingleSelect",
      required: true,
      defaultValue: "pages",
      options: [
        { value: "pages", label: "Pages" },
        { value: "snapshot", label: "Snapshot" },
      ],
    },
    { name: "origin", label: "Origin", type: "string", inputType: "url" },
    { name: "publishTo", label: "Publish to", type: "string" },
    { name: "historyMaxEntries", label: "History max entries", type: "number" },
    { name: "historyMaxAgeDays", label: "History max age (days)", type: "number" },
  ],
};

export const ARTICLE_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "title", label: "Title", type: "string", required: true },
    { name: "description", label: "Description", type: "string" },
    { name: "aspectId", label: "Aspect", type: "string" },
    { name: "published", label: "Published", type: "Checkbox", defaultChecked: true },
    { name: "tags", label: "Tags", type: "string", list: true },
  ],
};

export const BLOG_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "title", label: "Title", type: "string", required: true },
    { name: "parentId", label: "Parent", type: "string" },
    { name: "description", label: "Description", type: "string" },
    { name: "masterLayoutId", label: "Frame", type: "string" },
    { name: "aspectId", label: "Aspect", type: "string" },
  ],
};

export const CONTENT_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "parentId", label: "Parent", type: "string" },
    { name: "title", label: "Title", type: "string", required: true },
    { name: "masterLayoutId", label: "Frame", type: "string" },
    { name: "type", label: "Type", type: "string" },
    { name: "aspectId", label: "Aspect", type: "string" },
    { name: "description", label: "Description", type: "string" },
    { name: "showInNav", label: "Show in nav", type: "Checkbox", defaultChecked: true },
    { name: "tags", label: "Tags", type: "string", list: true },
    { name: "published", label: "Published", type: "Checkbox", defaultChecked: true },
  ],
};

export type AspectChoice = { id: string; label: string };

export const TEMPLATE_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "isLocked", label: "Lock layout on new pages", type: "Checkbox" },
    { name: "type", label: "Type", type: "string" },
  ],
};

export const LAYOUT_FORM: FormSchema = {
  fields: [{ name: "includes", label: "Includes", type: "string", list: true }],
};

export const ITEM_FORM: FormSchema = {
  fields: [
    { name: "id", label: "Id", type: "string", readOnly: true, required: true },
    { name: "tags", label: "Tags", type: "string", list: true },
  ],
};

/** Authored schema for a record kind. Other kinds build a temporary list from the file. */
export function authoredSchema(kind: string): FormSchema | undefined {
  if (kind === "site") return SITE_FORM;
  if (kind === "content") return CONTENT_FORM;
  if (kind === "templates") return TEMPLATE_FORM;
  if (kind === "layouts") return LAYOUT_FORM;
  if (kind === "items") return ITEM_FORM;
  return undefined;
}

export function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/** Replace the Frame text field with Inherit plus the site's frame layouts. */
export function withFrameChoices(schema: FormSchema, frames: readonly string[], current?: string): FormSchema {
  const ids = [...frames];
  if (current && !ids.includes(current)) ids.push(current);
  return {
    fields: schema.fields.map((field) =>
      field.name === "masterLayoutId"
        ? {
            ...field,
            type: "SingleSelect",
            options: [{ value: "", label: "Inherit" }, ...ids.map((id) => ({ value: id, label: id }))],
          }
        : field,
    ),
  };
}

/** Replace the Type text field with None plus the site's type ids. */
export function withTypeChoices(schema: FormSchema, types: readonly string[], current?: string): FormSchema {
  const ids = [...types];
  if (current && !ids.includes(current)) ids.push(current);
  return {
    fields: schema.fields.map((field) =>
      field.name === "type"
        ? {
            ...field,
            type: "SingleSelect",
            options: [{ value: "", label: "None" }, ...ids.map((id) => ({ value: id, label: id }))],
          }
        : field,
    ),
  };
}

/**
 * Replace the Parent text field with None plus other page ids.
 * `excludeId` is the current page (no self-parent). An orphan current parent is kept in the list.
 */
export function withParentChoices(
  schema: FormSchema,
  pageIds: readonly string[],
  excludeId?: string,
  current?: string,
): FormSchema {
  const ids = pageIds.filter((id) => id && id !== excludeId);
  if (current && current !== excludeId && !ids.includes(current)) ids.push(current);
  return {
    fields: schema.fields.map((field) =>
      field.name === "parentId"
        ? {
            ...field,
            type: "SingleSelect",
            options: [{ value: "", label: "None" }, ...ids.map((id) => ({ value: id, label: id }))],
          }
        : field,
    ),
  };
}

/** Clause after the resolved frame id: "set on events", "set on this page", or "the site frame". */
export function frameWhere(source: "page" | "ancestor" | "site" | undefined, fromPageId?: string): string {
  if (source === "page") return "set on this page";
  if (source === "ancestor" && fromPageId) return `set on ${fromPageId}`;
  return "the site frame";
}

/**
 * Replace the Aspect text field with Inherit plus the theme's aspects.
 * Drops the field when the catalog is empty and the page has no stored id.
 * An id absent from the catalog becomes "non-theme aspect specified" (no change on save).
 */
export function withAspectChoices(
  schema: FormSchema,
  aspects: readonly AspectChoice[],
  current?: string,
): FormSchema {
  if (!aspects.length && !current) {
    return { fields: schema.fields.filter((field) => field.name !== "aspectId") };
  }
  const options = [
    { value: "", label: "Inherit" },
    ...aspects.map((item) => ({ value: item.id, label: item.label })),
  ];
  const orphan = Boolean(current && !aspects.some((item) => item.id === current));
  if (orphan) {
    options.push({ value: ASPECT_NO_CHANGE, label: "non-theme aspect specified" });
  }
  return {
    fields: schema.fields.map((field) =>
      field.name === "aspectId"
        ? {
            ...field,
            type: "SingleSelect",
            options,
            ...(orphan ? { selectIfUnknown: ASPECT_NO_CHANGE } : {}),
          }
        : field,
    ),
  };
}

/**
 * Replace Default aspect with None plus the theme's aspects.
 * Drops the field when the catalog is empty.
 */
export function withDefaultAspectChoices(schema: FormSchema, aspects: readonly AspectChoice[]): FormSchema {
  if (!aspects.length) {
    return { fields: schema.fields.filter((field) => field.name !== "defaultAspectId") };
  }
  return {
    fields: schema.fields.map((field) =>
      field.name === "defaultAspectId"
        ? {
            ...field,
            type: "SingleSelect",
            options: [
              { value: "", label: "None" },
              ...aspects.map((item) => ({ value: item.id, label: item.label })),
            ],
          }
        : field,
    ),
  };
}

/** Fields for keys the authored schema does not name, so extra data stays editable. */
export function fieldsFromRecord(record: Record<string, unknown>, skip = new Set<string>()): FieldSchema[] {
  return Object.entries(record)
    .filter(([key]) => !skip.has(key))
    .map(([key, value]) => fieldFromValue(key, value));
}

export function schemaFor(kind: string, data: unknown): FormSchema | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  if (kind === "content" && record.type === "article") return ARTICLE_FORM;
  if (kind === "content" && record.type === "blog") return BLOG_FORM;
  if (kind === "content" && record.type === "blog-index") {
    return { fields: [{ name: "id", label: "Id", type: "string", readOnly: true, required: true }] };
  }
  const authored = authoredSchema(kind);
  if (!authored) return { fields: fieldsFromRecord(record) };
  const skip = new Set(authored.fields.map((field) => field.name));
  if (kind === "content" || kind === "templates") {
    skip.add("zones");
    skip.add("fields");
  }
  if (kind === "items") skip.add("zones");
  // Theme owns the aspect catalog; keep it off the site form.
  // Panel tones are site-owned and stay editable on the site form.
  if (kind === "site") {
    skip.add("aspects");
  }
  return { fields: [...authored.fields, ...fieldsFromRecord(record, skip)] };
}

function fieldFromValue(key: string, value: unknown): FieldSchema {
  const label = labelize(key);
  if (typeof value === "number") return { name: key, label, type: "number" };
  if (typeof value === "boolean") return { name: key, label, type: "Checkbox" };
  if (typeof value === "string") {
    if (value.includes("\n") || value.length > 120) return { name: key, label, type: "string", rows: 8 };
    return { name: key, label, type: "string" };
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return { name: key, label, type: "string", list: true };
  }
  return { name: key, label, type: "yaml", rows: 10 };
}
