import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  ApiError,
  getRecord,
  listRecords,
  login,
  logout,
  me,
  saveRecord,
  type PublicUser,
  type RecordList,
  type RecordSummary,
} from "./api";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chrome(user: PublicUser, inner: string, wide = false): string {
  return `<header class="w3-bar w3-theme">
      <a class="w3-bar-item w3-button" href="#/">Tessera editor</a>
      <span class="w3-bar-item w3-small">${escapeHtml(user.username)}</span>
      <button type="button" class="w3-bar-item w3-button w3-right" data-action="logout">Sign out</button>
    </header>
    <main class="editor-main${wide ? " editor-wide" : ""}">${inner}</main>`;
}

function loginView(error = "", username = ""): string {
  return `<header class="w3-bar w3-theme w3-large"><span class="w3-bar-item">Tessera editor</span></header>
    <main class="editor-main"><form id="login-form" class="w3-card w3-white w3-padding-large editor-card">
      <h1 class="w3-large">Sign in</h1>
      <p class="w3-text-grey">Session cookie stays on this origin. Seed user: <code>admin</code> / <code>admin</code>.</p>
      ${error ? `<p class="w3-panel w3-pale-red w3-leftbar w3-border-red" role="alert">${escapeHtml(error)}</p>` : ""}
      <p>
        <label for="username">Username</label>
        <input id="username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="username" required value="${escapeHtml(username)}" />
      </p>
      <p>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" class="w3-input w3-border w3-margin-top" autocomplete="current-password" required />
      </p>
      <p><button type="submit" class="w3-button w3-theme">Sign in</button></p>
    </form></main>`;
}

export async function mount(root: HTMLElement): Promise<void> {
  window.addEventListener("hashchange", () => void render(root));
  await render(root);
}

async function render(root: HTMLElement): Promise<void> {
  let user: PublicUser;
  try {
    user = await me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      bindLogin(root);
      return;
    }
    bindLogin(root, err instanceof Error ? err.message : "Could not load session.");
    return;
  }

  const route = parseRoute();
  try {
    if (!route.kind || !route.id) await bindList(root, user);
    else await bindEdit(root, user, route.kind, route.id);
  } catch (err) {
    root.innerHTML = chrome(
      user,
      `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(err instanceof Error ? err.message : "Error")}</p>
       <p><a href="#/">Back to records</a></p>`,
    );
    bindChrome(root);
  }
}

function parseRoute(): { kind?: string; id?: string } {
  const path = window.location.hash.replace(/^#\/?/, "");
  if (!path) return {};
  const slash = path.indexOf("/");
  if (slash === -1) return { kind: decodeURIComponent(path), id: decodeURIComponent(path) };
  return {
    kind: decodeURIComponent(path.slice(0, slash)),
    id: decodeURIComponent(path.slice(slash + 1)),
  };
}

function bindChrome(root: HTMLElement): void {
  root.querySelector("[data-action=logout]")?.addEventListener("click", async () => {
    await logout().catch(() => undefined);
    window.location.hash = "";
    bindLogin(root);
  });
}

function bindLogin(root: HTMLElement, error?: string, username = ""): void {
  root.innerHTML = loginView(error, username);
  const form = root.querySelector<HTMLFormElement>("#login-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const nextUsername = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    try {
      await login(nextUsername, password);
      await render(root);
    } catch (err) {
      bindLogin(root, err instanceof Error ? err.message : "Sign in failed.", nextUsername);
    }
  });
}

async function bindList(root: HTMLElement, user: PublicUser): Promise<void> {
  const listing = await listRecords();
  root.innerHTML = chrome(user, listHtml(listing), true);
  bindChrome(root);
}

function listHtml(listing: RecordList): string {
  const byKind = new Map<string, RecordSummary[]>();
  for (const rec of listing.records) {
    const list = byKind.get(rec.kind) ?? [];
    list.push(rec);
    byKind.set(rec.kind, list);
  }
  const sections = listing.kinds
    .map((kind) => {
      const rows = byKind.get(kind.kind) ?? [];
      if (!rows.length) return "";
      return `<section class="editor-kind">
        <h2 class="w3-medium">${escapeHtml(kind.label)}</h2>
        <ul class="w3-ul">
          ${rows
            .map(
              (row) =>
                `<li><a href="#/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}">${escapeHtml(row.title ?? row.id)}</a> <span class="w3-text-grey w3-small">${escapeHtml(row.id)}</span></li>`,
            )
            .join("")}
        </ul>
      </section>`;
    })
    .join("");
  return `<h1 class="w3-large">Records</h1>
    <p class="w3-text-grey">YAML files named with Tessera <code>id</code>, outside the web root. Saving flattens to <code>site.json</code>.</p>
    ${sections || "<p>No records yet.</p>"}`;
}

async function bindEdit(root: HTMLElement, user: PublicUser, kind: string, id: string): Promise<void> {
  const payload = await getRecord(kind, id);
  const status = `<p id="save-status" class="w3-text-grey" hidden></p>`;
  root.innerHTML = chrome(
    user,
    `<p><a href="#/">← Records</a></p>
     <h1 class="w3-large">${escapeHtml(kind)} / ${escapeHtml(id)}</h1>
     <form id="record-form" class="w3-card w3-white w3-padding-large editor-card">
       ${fieldsHtml(payload.data)}
       ${status}
       <p class="editor-actions"><button type="submit" class="w3-button w3-theme">Save</button></p>
     </form>`,
    true,
  );
  bindChrome(root);
  const form = root.querySelector<HTMLFormElement>("#record-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const statusEl = root.querySelector<HTMLElement>("#save-status");
    const button = form.querySelector("button[type=submit]");
    if (button) (button as HTMLButtonElement).disabled = true;
    try {
      const data = readForm(form, payload.data);
      await saveRecord(kind, id, data);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Saved and flattened.";
        statusEl.className = "w3-text-green";
      }
    } catch (err) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = err instanceof Error ? err.message : "Save failed.";
        statusEl.className = "w3-pale-red w3-padding";
      }
    } finally {
      if (button) (button as HTMLButtonElement).disabled = false;
    }
  });
}

function fieldsHtml(data: unknown): string {
  if (Array.isArray(data)) {
    return yamlField("_yaml", "Entries", data, 16);
  }
  if (!data || typeof data !== "object") {
    return yamlField("_yaml", "Data", data, 12);
  }
  const record = data as Record<string, unknown>;
  return Object.entries(record)
    .map(([key, value]) => fieldFor(key, value, key))
    .join("");
}

function fieldFor(key: string, value: unknown, path: string): string {
  if (key === "id") {
    return `<p><label>Id</label><input class="w3-input w3-border w3-margin-top" value="${escapeHtml(String(value ?? ""))}" disabled /></p>
      <input type="hidden" name="${escapeHtml(path)}" value="${escapeHtml(String(value ?? ""))}" />`;
  }
  if (key === "title" && typeof value === "string") {
    return textField(path, "Title", value);
  }
  if (key === "zones" && value && typeof value === "object" && !Array.isArray(value)) {
    return zoneFields(value as Record<string, unknown>);
  }
  if (typeof value === "string") {
    if (key === "html" || value.includes("<") || value.includes("\n") || value.length > 80) {
      return textareaField(path, labelize(key), value, key === "html" || key === "main" ? 16 : 8);
    }
    return textField(path, labelize(key), value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return textField(path, labelize(key), String(value));
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return textField(path, labelize(key), value.join(", "), "csv");
  }
  return yamlField(path, labelize(key), value, 10);
}

function zoneFields(zones: Record<string, unknown>): string {
  const keys = Object.keys(zones);
  const ordered = [
    ...keys.filter((k) => k === "title"),
    ...keys.filter((k) => k === "main"),
    ...keys.filter((k) => k !== "title" && k !== "main"),
  ];
  return ordered
    .map((name) => {
      const zone = zones[name];
      if (zone && typeof zone === "object" && !Array.isArray(zone) && "html" in zone) {
        const large = name === "main" || name === "minutes" || name === "hero";
        return textareaField(
          `zones.${name}.html`,
          name === "main" ? "Body" : `Zone: ${name}`,
          String((zone as { html: unknown }).html ?? ""),
          large ? 18 : 6,
        );
      }
      if (zone && typeof zone === "object" && !Array.isArray(zone) && "json" in zone) {
        return jsonZoneFields(name, (zone as { json: unknown }).json);
      }
      return yamlField(`zones.${name}`, `Zone: ${name}`, zone, 8);
    })
    .join("");
}

function jsonZoneFields(name: string, json: unknown): string {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const entries = Object.entries(json as Record<string, unknown>);
    if (entries.every(([, v]) => v === undefined || ["string", "number", "boolean"].includes(typeof v))) {
      return `<fieldset class="editor-fieldset"><legend>${escapeHtml(labelize(name))}</legend>${entries
        .map(([k, v]) => textField(`zones.${name}.json.${k}`, labelize(k), String(v ?? "")))
        .join("")}</fieldset>`;
    }
  }
  return yamlField(`zones.${name}.json`, labelize(name), json, 8);
}

function textField(name: string, label: string, value: string, type = "text"): string {
  const id = `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" data-kind="${type}" class="w3-input w3-border w3-margin-top" value="${escapeHtml(value)}" /></p>`;
}

function textareaField(name: string, label: string, value: string, rows: number): string {
  const id = `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const extra = rows >= 14 ? " editor-body" : "";
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" rows="${rows}" class="w3-input w3-border w3-margin-top${extra}">${escapeHtml(value)}</textarea></p>`;
}

function yamlField(name: string, label: string, value: unknown, rows: number): string {
  const id = `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const text = stringifyYaml(value, { indent: 2, lineWidth: 0 }).trimEnd();
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" data-kind="yaml" rows="${rows}" class="w3-input w3-border w3-margin-top editor-yaml">${escapeHtml(text)}</textarea></p>`;
}

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function readForm(form: HTMLFormElement, original: unknown): unknown {
  if (Array.isArray(original) || !(original && typeof original === "object")) {
    const yaml = String(new FormData(form).get("_yaml") ?? "");
    return parseYaml(yaml);
  }
  const next = structuredClone(original) as Record<string, unknown>;
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name || el.disabled) continue;
    setPath(next, el.name, parseField(el));
  }
  return next;
}

function parseField(el: HTMLInputElement | HTMLTextAreaElement): unknown {
  const kind = el.dataset.kind ?? "text";
  const value = el.value;
  if (kind === "csv") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (kind === "yaml") return parseYaml(value);
  return value;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}
