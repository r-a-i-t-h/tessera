/** Record kinds stored as one YAML file per Tessera `id`. */
export const RECORD_KINDS = [
  "content",
  "templates",
  "items",
  "layouts",
  "bindings",
  "types",
  "media",
  "folders",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

/**
 * Kinds that round-trip through the published document.
 * Templates are editor files: the folder is listed, and publish skips them.
 */
export const DOCUMENT_KINDS = [
  "content",
  "items",
  "layouts",
  "bindings",
  "types",
  "media",
  "folders",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABELS: Record<RecordKind, string> = {
  content: "Content",
  templates: "Templates",
  items: "Items",
  layouts: "Layouts",
  bindings: "Bindings",
  types: "Types",
  media: "Media",
  folders: "Folders",
};

export const KIND_DIRS: Record<RecordKind, string> = {
  content: "content",
  templates: "templates",
  items: "items",
  layouts: "layouts",
  bindings: "bindings",
  types: "types",
  media: "media",
  folders: "folders",
};

/** Filename = Tessera `id`. Restrict to a single path segment. */
export const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value);
}

export function isRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}
