import type { Context } from "hono";
import { apiError } from "../http.js";
import type { UserRecord } from "../model.js";

export type RestrictAccessLevel = "editor";

const LIMITED_EDITOR: RestrictAccessLevel = "editor";

/** Kinds a limited editor may read/write via /api/records. */
export const LIMITED_EDITOR_RECORD_KINDS = new Set(["content", "nav", "templates", "site"]);

export function isFullAdmin(user: UserRecord): boolean {
  return user.restrictAccessLevel !== LIMITED_EDITOR;
}

export function requireFullAdmin(c: Context): UserRecord | Response {
  const user = c.get("editor") ?? c.get("user");
  if (!user) return apiError(c, 401, "Authentication required");
  if (!isFullAdmin(user)) return apiError(c, 403, "Admin access required.");
  return user;
}

export function recordKindReadable(user: UserRecord, kind: string): boolean {
  if (isFullAdmin(user)) return true;
  return LIMITED_EDITOR_RECORD_KINDS.has(kind);
}

/** PUT and raw writes for a record kind. */
export function recordKindWritable(user: UserRecord, kind: string): boolean {
  if (isFullAdmin(user)) return true;
  return kind === "content" || kind === "nav";
}

export function assertRecordKindReadable(c: Context, kind: string): Response | undefined {
  const editor = c.get("editor");
  if (!editor) return apiError(c, 401, "Authentication required");
  if (!recordKindReadable(editor, kind)) return apiError(c, 403, "Admin access required.");
  return undefined;
}

export function assertRecordKindWritable(c: Context, kind: string): Response | undefined {
  const editor = c.get("editor");
  if (!editor) return apiError(c, 401, "Authentication required");
  if (!recordKindWritable(editor, kind)) return apiError(c, 403, "Admin access required.");
  return undefined;
}

export function assertFullAdmin(c: Context): Response | undefined {
  const editor = c.get("editor");
  if (!editor) return apiError(c, 401, "Authentication required");
  if (!isFullAdmin(editor)) return apiError(c, 403, "Admin access required.");
  return undefined;
}

type ListedRecord = { kind: string; [key: string]: unknown };

/** Filter GET /api/records for limited editors. */
export function filterRecordListingForLimitedEditor<T extends ListedRecord>(records: T[]): T[] {
  return records.filter((row) => LIMITED_EDITOR_RECORD_KINDS.has(row.kind));
}

export function parseRestrictAccessLevel(raw: unknown): RestrictAccessLevel | undefined {
  if (raw === LIMITED_EDITOR) return LIMITED_EDITOR;
  return undefined;
}
