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
  if (init.body !== undefined && !headers.has("Content-Type")) {
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

export function ping(): Promise<PingResult> {
  return request("/api/ping", { method: "POST" });
}

export type RecordKindName = string;

export type RecordSummary = {
  kind: RecordKindName;
  id: string;
  title?: string;
};

export type RecordList = {
  ok: true;
  kinds: { kind: string; label: string }[];
  records: RecordSummary[];
};

export type PageLayoutHint = {
  layoutId: string;
  layoutTitle?: string;
  layoutSource: "page" | "section" | "site";
  sectionId?: string;
  declaredZones: string[];
  offLayoutZones: string[];
  layouts: Record<string, { title?: string; zones: string[] }>;
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

export type RenderResult = {
  ok: true;
  pages: number;
  snapshot?: SnapshotRef;
};

export function renderSite(): Promise<RenderResult> {
  return request("/api/render", { method: "POST" });
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
