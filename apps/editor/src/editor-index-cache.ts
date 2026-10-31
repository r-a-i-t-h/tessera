import { ApiError } from "./api.js";

export type EditorIndexItem = {
  category: string;
  label: string;
  filterText: string;
  hash?: string;
  action?: "render" | "publish";
};

export type EditorIndexResponse = {
  ok: true;
  version: string;
  items: EditorIndexItem[];
};

let cached: { etag: string; items: EditorIndexItem[] } | null = null;

/** Drop the in-memory editor index (next palette open refetches). */
export function invalidateEditorIndex(): void {
  cached = null;
}

/** Load the command palette index, using client cache and conditional GET. */
export async function loadEditorIndex(): Promise<EditorIndexItem[]> {
  const headers = new Headers();
  if (cached?.etag) headers.set("If-None-Match", cached.etag);
  let res: Response;
  try {
    res = await fetch("/api/editor-index", { credentials: "same-origin", headers });
  } catch {
    throw new ApiError(0, "Cannot reach the editor API. Is it running?");
  }
  if (res.status === 304 && cached) return cached.items;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : res.statusText || "Request failed.";
    throw new ApiError(res.status, message);
  }
  const body = data as EditorIndexResponse;
  const etag = res.headers.get("ETag") ?? `"${body.version}"`;
  cached = { etag, items: body.items };
  return body.items;
}

export function peekEditorIndexCache(): EditorIndexItem[] | undefined {
  return cached?.items;
}
