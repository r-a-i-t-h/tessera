export type PublicUser = {
  ok: true;
  username: string;
  createdAt: string;
};

export type PingResult = {
  ok: true;
  username: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the editor API. Is it running?");
  }

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(data, res.statusText));
  }
  return data as T;
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback || "Request failed.";
}

export function login(username: string, password: string): Promise<{ ok: true; username: string }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function me(): Promise<PublicUser> {
  return request("/auth/me");
}

export function logout(): Promise<{ ok: true }> {
  return request("/auth/logout", { method: "POST" });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ ok: true }> {
  return request("/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
}

export function changeUsername(username: string): Promise<{ ok: true; username: string }> {
  return request("/auth/username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export type ManagedUser = {
  username: string;
  createdAt: string;
  disabled: boolean;
};

export type UserList = {
  ok: true;
  users: ManagedUser[];
};

export type UserWrite = {
  username?: string;
  password?: string;
  disabled?: boolean;
};

export function listUsers(): Promise<UserList> {
  return request("/api/users");
}

export function createUser(username: string, password: string): Promise<{ ok: true; user: ManagedUser }> {
  return request("/api/users", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function updateUser(
  username: string,
  patch: UserWrite,
): Promise<{ ok: true; user: ManagedUser }> {
  return request(`/api/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteUser(username: string): Promise<{ ok: true }> {
  return request(`/api/users/${encodeURIComponent(username)}`, { method: "DELETE" });
}

export function ping(): Promise<PingResult> {
  return request("/api/ping", { method: "POST" });
}

export type RecordKindName = string;

export type RecordSummary = {
  kind: RecordKindName;
  id: string;
  title?: string;
  type?: string;
  tags?: string[];
};

export type RecordList = {
  ok: true;
  kinds: { kind: string; label: string }[];
  records: RecordSummary[];
};

export type PageLayoutHint = {
  layoutId: string;
  layoutSource: "type" | "site";
  typeId?: string;
  fields: { id: string; required?: boolean }[];
  declaredZones: string[];
  offLayoutZones: string[];
  layouts: Record<string, { zones: string[] }>;
  /** Layout ids that contain a page slot. */
  frames?: string[];
  /** Resolved frame, when the site or a page in the chain names one. */
  masterLayoutId?: string;
  masterSource?: "page" | "ancestor" | "site";
  /** Page that set the frame, when `masterSource` is `page` or `ancestor`. */
  masterFromPageId?: string;
};

export type SnapshotRef = {
  hash: string;
  file: string;
};

export type HistorySummary = {
  index: number;
  savedAt: string;
  schemaVersion: number;
  bytes: number;
};

export type RecordPayload = {
  ok: true;
  kind: string;
  id: string;
  data: unknown;
  raw: string;
  file: string;
  historyFile?: string;
  schemaVersion: number;
  snapshot?: SnapshotRef;
  layout?: PageLayoutHint;
  history?: HistorySummary[];
};

export type SaveResult = {
  ok: true;
  kind: string;
  id: string;
  historyAppended: boolean;
  historyCount: number;
  snapshot?: SnapshotRef;
};

export type HistoryEntry = {
  ok: true;
  index: number;
  savedAt: string;
  schemaVersion: number;
  raw: string;
};

export type DistResult = {
  flavour: "pages" | "snapshot";
  pages?: number;
  snapshot?: SnapshotRef;
};

export type RenderResult = {
  ok: true;
  pages: number;
  snapshot?: SnapshotRef;
};

export type PublishResult = {
  ok: true;
  pages: number;
  dist: DistResult;
  /** Set when `publishTo` was installed. */
  installed?: string;
};

export function renderSite(): Promise<RenderResult> {
  return request("/api/render", { method: "POST" });
}

export function publishSite(): Promise<PublishResult> {
  return request("/api/publish", { method: "POST" });
}

export function initSite(): Promise<RenderResult> {
  return request("/api/site/init", { method: "POST" });
}

export function listRecords(): Promise<RecordList> {
  return request("/api/records");
}

export function getRecord(kind: string, id: string): Promise<RecordPayload> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
}

export function saveRecord(kind: string, id: string, data: unknown): Promise<SaveResult> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export function saveRawRecord(kind: string, id: string, raw: string): Promise<SaveResult> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ raw }),
  });
}

export function getHistoryEntry(kind: string, id: string, index: number): Promise<HistoryEntry> {
  return request(
    `/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/history/${index}`,
  );
}

export type BackupInfo = {
  name: string;
  size: number;
  mtime: string;
};

export type ExampleInfo = {
  name: string;
  title: string;
};

export type BackupList = {
  ok: true;
  directory: string;
  backups: BackupInfo[];
  examples: ExampleInfo[];
};

export type RestoreResult = {
  ok: true;
  restored: string;
  safetyBackup: string;
};

export function listBackups(): Promise<BackupList> {
  return request("/api/backups");
}

export function createBackup(): Promise<{ ok: true; name: string; size: number; mtime: string }> {
  return request("/api/backups", { method: "POST" });
}

export function restoreBackup(name: string): Promise<RestoreResult> {
  return request(`/api/backups/${encodeURIComponent(name)}/restore`, { method: "POST" });
}

export function deleteBackup(name: string): Promise<{ ok: true; deleted: string }> {
  return request(`/api/backups/${encodeURIComponent(name)}/delete`, { method: "POST" });
}

export function restoreExample(name: string): Promise<RestoreResult> {
  return request(`/api/examples/${encodeURIComponent(name)}/restore`, { method: "POST" });
}

export function reseedSite(): Promise<RestoreResult> {
  return request("/api/site/reseed", { method: "POST" });
}

export type LibraryFolder = { id: string; parentId: string | null; sort?: number };
export type LibraryAsset = {
  id: string;
  name: string;
  kind: "image" | "document";
  ext: string;
  folderId: string | null;
  title?: string;
  alt?: string;
  caption?: string;
  sort?: number;
  url: string;
};
export type LibraryListing = { ok: true; folders: LibraryFolder[]; assets: LibraryAsset[] };

export function getLibrary(): Promise<LibraryListing> {
  return request("/api/library");
}

export function createLibraryFolder(id: string, parentId?: string): Promise<{ ok: true }> {
  return request("/api/library/folders", {
    method: "POST",
    body: JSON.stringify({ id, ...(parentId ? { parentId } : {}) }),
  });
}

export function updateLibraryFolder(id: string, patch: { parentId?: string | null }): Promise<{ ok: true }> {
  return request(`/api/library/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteLibraryFolder(id: string): Promise<{ ok: true }> {
  return request(`/api/library/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function uploadLibrary(body: FormData): Promise<{ ok: true; created: { id: string }[]; skipped: { name: string; reason: string }[] }> {
  return request("/api/library/upload", { method: "POST", body });
}

export function updateLibraryAsset(
  id: string,
  patch: { name?: string; title?: string; alt?: string; caption?: string; folderId?: string | null },
): Promise<{ ok: true }> {
  return request(`/api/library/assets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteLibraryAsset(id: string): Promise<{ ok: true }> {
  return request(`/api/library/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type StylesheetRecord = {
  id: string;
  label: string;
  text: string;
  overridden: boolean;
};

export function listStylesheets(): Promise<StylesheetRecord[]> {
  return request<{ ok: true; sheets: StylesheetRecord[] }>("/api/stylesheets").then((body) => body.sheets);
}

export function saveStylesheet(id: string, text: string): Promise<void> {
  return request(`/api/stylesheets/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}
