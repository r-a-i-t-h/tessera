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

export type RecordPayload = {
  ok: true;
  kind: string;
  id: string;
  data: unknown;
  layout?: PageLayoutHint;
};

export function listRecords(): Promise<RecordList> {
  return request("/api/records");
}

export function getRecord(kind: string, id: string): Promise<RecordPayload> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
}

export function saveRecord(kind: string, id: string, data: unknown): Promise<{ ok: true }> {
  return request(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}
