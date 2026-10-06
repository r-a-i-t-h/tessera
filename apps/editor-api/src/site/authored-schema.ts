import {
  BindingSchema,
  BlockSchema,
  FolderSchema,
  LayoutSchema,
  NavEntrySchema,
  SiteMetaSchema,
  TypeSchema,
} from "@r-a-i-t-h/tessera-model";
import { z } from "zod";
import type { RecordKind } from "./kinds.js";

export type AuthoredKind = RecordKind | "site" | "nav";

export class AuthoredRecordError extends Error {
  constructor(
    readonly kind: AuthoredKind,
    readonly id: string,
    readonly field: string,
    detail: string,
  ) {
    const label = kind === "content" ? "Content" : kind[0]!.toUpperCase() + kind.slice(1);
    super(`${label} record "${id}": ${field || "record"} ${detail}.`);
    this.name = "AuthoredRecordError";
  }
}

const id = z.string().min(1);
const stringList = z.array(z.string());

const authoredZone = z.unknown().superRefine((value, ctx) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a mapping" });
    return;
  }
  const row = value as Record<string, unknown>;
  const variants = ["html", "json", "component", "blocks"].filter((key) =>
    Object.prototype.hasOwnProperty.call(row, key),
  );
  if (variants.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "must be exactly one of html, json, component, or blocks",
    });
    return;
  }
  if (variants[0] === "html" && typeof row.html !== "string") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["html"], message: "must be a string" });
  } else if (variants[0] === "component") {
    if (typeof row.component !== "string" || !row.component) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["component"], message: "must be a non-empty string" });
    }
    if (row.props !== undefined && (!row.props || typeof row.props !== "object" || Array.isArray(row.props))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["props"], message: "must be a mapping" });
    }
  } else if (variants[0] === "blocks") {
    const parsed = z.array(BlockSchema).safeParse(row.blocks);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: ["blocks", ...issue.path] });
      }
    }
  }
});

const zones = z.record(authoredZone).optional();

const authoredPage = z.object({
  id,
  title: z.string(),
  description: z.string().optional(),
  slug: z.string().optional(),
  parentId: id.optional(),
  masterLayoutId: id.optional(),
  showInNav: z.boolean().optional(),
  type: id.optional(),
  fields: z.record(z.string()).optional(),
  tags: stringList.optional(),
  includes: stringList.optional(),
  zones,
}).passthrough();

const authoredTemplate = z.object({
  id,
  isLocked: z.boolean().optional(),
  locked: z.boolean().optional(),
  type: id.optional(),
  fields: z.record(z.string()).optional(),
  tags: stringList.optional(),
  includes: stringList.optional(),
  zones,
}).passthrough();

const authoredItem = z.object({
  id,
  tags: stringList.optional(),
  zones,
}).passthrough();

const libraryMedia = z.object({
  id,
  name: z.string().optional(),
  kind: z.enum(["image", "document"]),
  ext: id,
  folderId: id.optional(),
  title: z.string().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  sort: z.number().optional(),
}).passthrough();

const handMedia = z.object({
  id,
  url: id,
}).passthrough();

const libraryFolder = z.object({
  id,
  parentId: id.optional(),
  sort: z.number().optional(),
}).passthrough();

const siteFile = SiteMetaSchema.extend({
  version: z.number().int().optional(),
});

export function validateAuthoredRecord(kind: AuthoredKind, recordId: string, data: unknown): void {
  const schema = schemaFor(kind, data);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new AuthoredRecordError(kind, recordId, issuePath(issue.path), issue.message);
  }
  if (kind !== "site" && kind !== "nav") {
    const actual = (data as { id?: unknown }).id;
    if (actual !== recordId) {
      throw new AuthoredRecordError(kind, recordId, "id", `must match filename id "${recordId}"`);
    }
  }
}

function schemaFor(kind: AuthoredKind, data: unknown): z.ZodTypeAny {
  switch (kind) {
    case "site":
      return siteFile;
    case "nav":
      return z.array(NavEntrySchema);
    case "content":
      return authoredPage;
    case "templates":
      return authoredTemplate;
    case "items":
      return authoredItem;
    case "layouts":
      return LayoutSchema;
    case "bindings":
      return BindingSchema;
    case "types":
      return TypeSchema;
    case "media":
      return isRecord(data) && ("kind" in data || "ext" in data) ? libraryMedia : handMedia;
    case "folders":
      return isRecord(data) && typeof data.path === "string" && data.path.length > 0
        ? FolderSchema
        : libraryFolder;
  }
}

function issuePath(path: PropertyKey[]): string {
  if (!path.length) return "record";
  return path.reduce<string>((out, part) => {
    if (typeof part === "number") return `${out}[${part}]`;
    return out ? `${out}.${String(part)}` : String(part);
  }, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
