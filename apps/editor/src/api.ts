import type { DatasetFile, DatasetField, SchemaAdaptationSummary } from "@r-a-i-t-h/tessera-model";
import { invalidateEditorIndex } from "./editor-index-cache.js";

export type PublicUser = {
  ok: true;
  username: string;
  createdAt: string;
  restrictAccessLevel?: "editor";
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
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && path.startsWith("/api/")) {
    invalidateEditorIndex();
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
  restrictAccessLevel?: "editor";
};

export type UserList = {
  ok: true;
  users: ManagedUser[];
};

export type UserWrite = {
  username?: string;
  password?: string;
  disabled?: boolean;
  restrictAccessLevel?: "editor" | null;
};

export function listUsers(): Promise<UserList> {
  return request("/api/users");
}

export function createUser(
  username: string,
  password: string,
  options?: { restrictAccessLevel?: "editor" },
): Promise<{ ok: true; user: ManagedUser }> {
  return request("/api/users", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      ...(options?.restrictAccessLevel === "editor" ? { restrictAccessLevel: "editor" } : {}),
    }),
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
  date?: string;
  parentId?: string;
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
  /** Zone ids declared on any frame layout (page slot present). */
  frameZoneCatalog?: string[];
  /** Page zone keys shown on the Frame tab (present keys minus page-layout zones). */
  frameEditorZones?: string[];
  /** Zones on the resolved master minus page-layout overlap (for Frame tab notes). */
  activeFrameZoneIds?: string[];
  layouts: Record<string, { zones: string[] }>;
  /** Layout ids that contain a page slot. */
  frames?: string[];
  /** Resolved frame, when the site or a page in the chain names one. */
  masterLayoutId?: string;
  masterSource?: "page" | "ancestor" | "site";
  /** Page that set the frame, when `masterSource` is `page` or `ancestor`. */
  masterFromPageId?: string;
  /** Looks the current theme offers. */
  aspects?: { id: string; label: string }[];
  /** Resolved aspect, when the site or a page in the chain names one. */
  aspectId?: string;
  aspectSource?: "page" | "ancestor" | "site";
  /** Page that set the aspect, when `aspectSource` is `page` or `ancestor`. */
  aspectFromPageId?: string;
  /** Extra Compose panel/quote tones from the site catalog. */
  panelTones?: { id: string; label: string; className: string }[];
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
  /** Public site URL from Records → Site → Origin. */
  origin?: string;
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

export type MaintenanceFinding = {
  href: string;
  label: string;
  detail?: string;
};

export type MaintenanceReport = {
  ok: true;
  orphans: MaintenanceFinding[];
  unusedAssets: MaintenanceFinding[];
  brokenRefs: MaintenanceFinding[];
  unusedItems: MaintenanceFinding[];
  unusedLayouts: MaintenanceFinding[];
  unknownBindings: MaintenanceFinding[];
  unreachableNav: MaintenanceFinding[];
  rescanDrift: {
    danglingMedia: MaintenanceFinding[];
    scannedAssets: MaintenanceFinding[];
  };
};

export function getMaintenance(): Promise<MaintenanceReport> {
  return request("/api/maintenance");
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

export function deleteContent(id: string): Promise<{ ok: true }> {
  return request(`/api/records/content/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function deleteItem(id: string): Promise<{ ok: true }> {
  return request(`/api/records/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function deleteBinding(id: string): Promise<{ ok: true }> {
  return request(`/api/records/bindings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function duplicateRecord(
  kind: string,
  id: string,
  nextId: string,
): Promise<{ ok: true; id: string }> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ id: nextId }),
  });
}

export function renameItem(id: string, nextId: string): Promise<{ ok: true; id: string }> {
  return request(`/api/records/items/${encodeURIComponent(id)}/rename`, {
    method: "POST",
    body: JSON.stringify({ id: nextId }),
  });
}

export function deleteBlog(id: string): Promise<{ ok: true }> {
  return request(`/api/records/blogs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function cascadeBlog(id: string): Promise<{ ok: true }> {
  return request(`/api/records/blogs/${encodeURIComponent(id)}/cascade`, { method: "POST" });
}

export function renameContent(id: string, nextId: string): Promise<{ ok: true; id: string }> {
  return request(`/api/records/content/${encodeURIComponent(id)}/rename`, {
    method: "POST",
    body: JSON.stringify({ id: nextId }),
  });
}

export function renameBlog(id: string, nextId: string): Promise<{ ok: true; id: string }> {
  return request(`/api/records/blogs/${encodeURIComponent(id)}/rename`, {
    method: "POST",
    body: JSON.stringify({ id: nextId }),
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

export function uploadBackup(file: File): Promise<{ ok: true; name: string; size: number; mtime: string }> {
  const body = new FormData();
  body.append("file", file);
  return request("/api/backups/upload", { method: "POST", body });
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

export type ThemeKitInfo = {
  id: string;
  name: string;
  version: number;
  stack: string;
  zonesDeclared?: Record<string, string[]>;
};

export function listThemeKits(): Promise<{ ok: true; kits: ThemeKitInfo[] }> {
  return request("/api/themes");
}

export function applyThemeKit(
  id: string,
  options?: { importDemo?: boolean },
): Promise<RestoreResult & { kitId: string; importDemo: boolean; pages?: number }> {
  return request(`/api/themes/${encodeURIComponent(id)}/apply`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export function resetThemeDemo(id: string): Promise<RestoreResult> {
  return request(`/api/themes/${encodeURIComponent(id)}/reset-demo`, { method: "POST" });
}

export type LibraryFolder = { id: string; parentId: string | null; sort?: number; system?: boolean };
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
  width?: number;
  height?: number;
  bytes?: number;
  addedAt?: string;
  url: string;
};
export type LibraryListing = { ok: true; folders: LibraryFolder[]; assets: LibraryAsset[] };

export function getLibrary(): Promise<LibraryListing> {
  return request("/api/library");
}

export type RuntimeModuleAsset = {
  id: string;
  ext: string;
  title?: string;
  url: string;
  bytes?: number;
};

export function getRuntimeModules(): Promise<{ ok: true; modules: RuntimeModuleAsset[] }> {
  return request("/api/runtime-modules");
}

export function getRuntimeModuleRaw(id: string): Promise<{ ok: true; text: string }> {
  return request(`/api/runtime-modules/${encodeURIComponent(id)}/raw`);
}

export function putRuntimeModuleRaw(id: string, text: string): Promise<{ ok: true }> {
  return request(`/api/runtime-modules/${encodeURIComponent(id)}/raw`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

export function patchRuntimeModule(id: string, patch: { title?: string | null }): Promise<{ ok: true }> {
  return request(`/api/runtime-modules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function uploadRuntimeModule(body: FormData): Promise<{ ok: true; id: string }> {
  return request("/api/runtime-modules/upload", { method: "POST", body });
}

export function deleteRuntimeModule(id: string): Promise<{ ok: true }> {
  return request(`/api/runtime-modules/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function duplicateRuntimeModule(sourceId: string, nextId: string): Promise<{ ok: true; id: string }> {
  return request(`/api/runtime-modules/${encodeURIComponent(sourceId)}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ id: nextId }),
  });
}

export function createLibraryFolder(id: string, parentId?: string): Promise<{ ok: true }> {
  return request("/api/library/folders", {
    method: "POST",
    body: JSON.stringify({ id, ...(parentId ? { parentId } : {}) }),
  });
}

export function updateLibraryFolder(
  id: string,
  patch: { parentId?: string | null; nextId?: string },
): Promise<{ ok: true }> {
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

export function rescanLibrary(): Promise<{
  ok: true;
  removed: { id: string; name: string }[];
  added: { id: string; name: string; folderId: string }[];
  skipped: { name: string; reason: string }[];
}> {
  return request("/api/library/rescan", { method: "POST" });
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

export function replaceLibraryAsset(id: string, body: FormData): Promise<{ ok: true; id: string }> {
  return request(`/api/library/assets/${encodeURIComponent(id)}/replace`, { method: "POST", body });
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

export type DatasetSummary = {
  id: string;
  title: string;
  recordCount: number;
  invalidCount: number;
};

export function listDatasets(): Promise<{ ok: true; datasets: DatasetSummary[] }> {
  return request("/api/datasets");
}

export function createDataset(id: string, title: string): Promise<{ ok: true; file: DatasetFile }> {
  return request("/api/datasets", { method: "POST", body: JSON.stringify({ id, title }) });
}

export function getDataset(id: string): Promise<{
  ok: true;
  file: DatasetFile;
  recordIssues: { uid: number; issues: { path: string; message: string }[] }[];
}> {
  return request(`/api/datasets/${encodeURIComponent(id)}`);
}

export function deleteDataset(id: string): Promise<{ ok: true }> {
  return request(`/api/datasets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateDatasetTitle(id: string, title: string): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export function updateDatasetView(
  id: string,
  view: { columns: string[]; displayName?: string },
): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/view`, {
    method: "PUT",
    body: JSON.stringify(view),
  });
}

export function updateDatasetSchema(
  id: string,
  schema: { fields: DatasetField[] },
): Promise<{ ok: true; file: DatasetFile; summary: SchemaAdaptationSummary }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/schema`, {
    method: "PUT",
    body: JSON.stringify({ schema }),
  });
}

export function appendDatasetRecord(
  id: string,
  record: Record<string, unknown>,
): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/records`, {
    method: "POST",
    body: JSON.stringify({ record }),
  });
}

export function saveDatasetRecord(
  id: string,
  uid: number,
  record: Record<string, unknown>,
): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/records/${uid}`, {
    method: "PUT",
    body: JSON.stringify({ record }),
  });
}

export function patchDatasetRecords(
  id: string,
  items: { uid: number; record: Record<string, unknown> }[],
): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/records`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

export function deleteDatasetRecord(id: string, uid: number): Promise<{ ok: true; file: DatasetFile }> {
  return request(`/api/datasets/${encodeURIComponent(id)}/records/${uid}`, { method: "DELETE" });
}

export function datasetRootRecords(id: string): Promise<{
  ok: true;
  id: string;
  records: { uid: number; displayName: string }[];
}> {
  return request(`/api/datasets/${encodeURIComponent(id)}/roots`);
}
