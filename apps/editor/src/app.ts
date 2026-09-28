import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  ApiError,
  createBackup,
  deleteBackup,
  getHistoryEntry,
  getRecord,
  listBackups,
  listRecords,
  login,
  logout,
  me,
  restoreBackup,
  renderSite,
  restoreExample,
  saveRawRecord,
  saveRecord,
  type BackupList,
  type PublicUser,
  type PageLayoutHint,
  type RecordList,
  type RecordPayload,
  type RecordSummary,
  type RenderResult,
  type SaveResult,
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
      <a class="w3-bar-item w3-button" href="#/backups">Backups</a>
      <button type="button" class="w3-bar-item w3-button" data-action="render-site">Render site</button>
      <span class="w3-bar-item w3-small">${escapeHtml(user.username)}</span>
      <button type="button" class="w3-bar-item w3-button w3-right" data-action="logout">Sign out</button>
    </header>
    <p id="render-status" class="editor-render-status" hidden></p>
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
    if (route.kind === "backups") await bindBackups(root, user);
    else if (!route.kind || !route.id) await bindList(root, user);
    else await bindEdit(root, user, route.kind, route.id, route.kind === "content" ? "raw" : "fields");
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

const previewUrl = "http://localhost:5173/";

function bindChrome(root: HTMLElement): void {
  root.querySelector("[data-action=logout]")?.addEventListener("click", async () => {
    await logout().catch(() => undefined);
    window.location.hash = "";
    bindLogin(root);
  });
  root.querySelector("[data-action=render-site]")?.addEventListener("click", () => {
    void runRender(root);
  });
}

async function runRender(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>("[data-action=render-site]");
  const status = root.querySelector<HTMLElement>("#render-status");
  if (button) button.disabled = true;
  if (status) {
    status.hidden = false;
    status.className = "editor-render-status w3-pale-yellow";
    status.textContent = "Rendering the whole site…";
  }
  try {
    const result = await renderSite();
    if (status) {
      status.className = "editor-render-status w3-pale-green";
      status.textContent = renderNotice(result);
    }
  } catch (err) {
    if (status) {
      status.className = "editor-render-status w3-pale-red";
      status.textContent = err instanceof Error ? err.message : "Render failed.";
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function renderNotice(result: RenderResult): string {
  const pages = `${result.pages} ${result.pages === 1 ? "page" : "pages"}`;
  const file = result.snapshot ? ` Snapshot ${result.snapshot.file}.` : "";
  return `Rendered ${pages} into the preview.${file} Reload ${previewUrl} to see it.`;
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

async function bindBackups(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listBackups();
  root.innerHTML = chrome(user, backupsHtml(listing, notice, error), true);
  bindChrome(root);
  root.querySelector("[data-action=backup]")?.addEventListener("click", async () => {
    const button = root.querySelector<HTMLButtonElement>("[data-action=backup]");
    if (button) button.disabled = true;
    try {
      const created = await createBackup();
      await bindBackups(root, user, `Archived this site as ${created.name} (${formatBytes(created.size)}).`);
    } catch (err) {
      await bindBackups(root, user, "", err instanceof Error ? err.message : "Backup failed.");
    }
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-restore]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.restore ?? "";
      if (!name) return;
      if (!window.confirm(`Replace this site with ${name}? The current site is saved as a new backup first.`)) return;
      void runRestore(root, user, () => restoreBackup(name), name);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-delete]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.delete ?? "";
      if (!name || !window.confirm(`Delete ${name}?`)) return;
      void (async () => {
        try {
          await deleteBackup(name);
          await bindBackups(root, user, `Deleted ${name}.`);
        } catch (err) {
          await bindBackups(root, user, "", err instanceof Error ? err.message : "Delete failed.");
        }
      })();
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-example]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.example ?? "";
      const title = button.dataset.title ?? name;
      if (!name) return;
      if (
        !window.confirm(
          `Replace this site's pages, shell, and published files with ${title}? Your editors stay. The current site is saved as a new backup first.`,
        )
      ) {
        return;
      }
      void runRestore(root, user, () => restoreExample(name), title);
    });
  }
}

async function runRestore(
  root: HTMLElement,
  user: PublicUser,
  action: () => Promise<{ safetyBackup: string }>,
  label: string,
): Promise<void> {
  try {
    const result = await action();
    await bindBackups(
      root,
      user,
      `Restored ${label}. The previous site is ${result.safetyBackup}.`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      bindLogin(root, "Sign in again. This restore replaced the editors.");
      return;
    }
    await bindBackups(root, user, "", err instanceof Error ? err.message : "Restore failed.");
  }
}

function backupsHtml(listing: BackupList, notice: string, error: string): string {
  const rows = listing.backups.length
    ? `<ul class="w3-ul">${listing.backups
        .map(
          (item) => `<li class="editor-backup">
            <a href="/api/backups/${encodeURIComponent(item.name)}">${escapeHtml(item.name)}</a>
            <span class="w3-text-grey w3-small">${formatBytes(item.size)}</span>
            <button type="button" class="w3-button w3-small w3-white" data-restore="${escapeHtml(item.name)}">Restore</button>
            <button type="button" class="w3-button w3-small w3-white" data-delete="${escapeHtml(item.name)}">Delete</button>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="w3-text-grey">No backups yet.</p>`;
  const examples = listing.examples.length
    ? `<ul class="w3-ul">${listing.examples
        .map(
          (item) => `<li class="editor-backup">
            <span>${escapeHtml(item.title)}</span>
            <button type="button" class="w3-button w3-small w3-white" data-example="${escapeHtml(item.name)}" data-title="${escapeHtml(item.title)}">Restore</button>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="w3-text-grey">No example archives are in the backup folder yet.</p>`;
  return `<h1 class="w3-large">Backups</h1>
    ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
    ${error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : ""}
    <p class="w3-text-grey">A backup is a dated <code>.tar.gz</code> of this site directory (records, editors, history, shell, and <code>publish/</code>). Session handoff is left out. Files live in <code>${escapeHtml(listing.directory)}</code>, outside the release, so an update does not remove them. Drop a file named like <code>2026-09-28T191500Z.tar.gz</code> there over SFTP and it shows up in this list.</p>
    <p><button type="button" class="w3-button w3-theme" data-action="backup">Back up now</button></p>
    ${rows}
    <h2 class="w3-medium">Examples</h2>
    <p class="w3-text-grey">Pure, Ineffable, Miller's Ark, and Willow are <code>.tar.gz</code> files in that same backup folder. Restoring one fills this empty site. Your editors stay. Later these become templates (a personal site, a blog, a committee, a club).</p>
    ${examples}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
    <p class="w3-text-grey">YAML files named with Tessera <code>id</code>, outside the web root. Saving a page appends the previous file to a history file and updates the snapshot. <strong>Render site</strong> writes every page into the preview on port 5173.</p>
    ${sections || "<p>No records yet.</p>"}`;
}

type EditMode = "fields" | "raw";

async function bindEdit(
  root: HTMLElement,
  user: PublicUser,
  kind: string,
  id: string,
  mode: EditMode,
  notice = "",
): Promise<void> {
  const payload = await getRecord(kind, id);
  const formInner =
    mode === "raw"
      ? `<p><label for="raw-file">Raw YAML</label>
         <textarea id="raw-file" name="raw" rows="24" spellcheck="false" class="w3-input w3-border w3-margin-top editor-raw">${escapeHtml(payload.raw)}</textarea></p>`
      : fieldsHtml(payload.data, payload.layout);
  root.innerHTML = chrome(
    user,
    `<p><a href="#/">← Records</a></p>
     <h1 class="w3-large">${escapeHtml(kind)} / ${escapeHtml(id)}</h1>
     ${lifecycleHtml(payload)}
     ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
     <p class="editor-tabs">
       <button type="button" class="w3-button ${mode === "fields" ? "w3-theme" : "w3-white"}" data-mode="fields">Fields</button>
       <button type="button" class="w3-button ${mode === "raw" ? "w3-theme" : "w3-white"}" data-mode="raw">Raw file</button>
     </p>
     <p class="w3-text-grey"><code>${escapeHtml(payload.file)}</code></p>
     <form id="record-form" class="w3-card w3-white w3-padding-large editor-card">
       ${formInner}
       <p id="save-status" class="w3-text-grey" hidden></p>
       <p class="editor-actions"><button type="submit" class="w3-button w3-theme">Save</button></p>
     </form>
     ${historyHtml(payload)}`,
    true,
  );
  bindChrome(root);
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode === "raw" ? "raw" : "fields";
      if (next !== mode) void bindEdit(root, user, kind, id, next);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-history]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.history);
      void showHistory(root, kind, id, index);
    });
  }
  const form = root.querySelector<HTMLFormElement>("#record-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button) (button as HTMLButtonElement).disabled = true;
    try {
      const saved =
        mode === "raw"
          ? await saveRawRecord(kind, id, form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "")
          : await saveRecord(kind, id, pruneEmptyHtmlZones(readForm(form, payload.data)));
      await bindEdit(root, user, kind, id, mode, saveNotice(saved));
    } catch (err) {
      const statusEl = root.querySelector<HTMLElement>("#save-status");
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = err instanceof Error ? err.message : "Save failed.";
        statusEl.className = "w3-pale-red w3-padding";
      }
      if (button) (button as HTMLButtonElement).disabled = false;
    }
  });
}

function lifecycleHtml(payload: RecordPayload): string {
  const published = payload.snapshot
    ? ` Published snapshot <code>${escapeHtml(payload.snapshot.file)}</code> is the name the browser caches.`
    : "";
  return `<p class="w3-text-grey" id="lifecycle">Authoring schema ${payload.schemaVersion}.${published}</p>`;
}

function historyHtml(payload: RecordPayload): string {
  if (!payload.history || !payload.historyFile) return "";
  const rows = [...payload.history].reverse();
  const list = rows.length
    ? `<ul class="w3-ul">${rows
        .map(
          (entry) =>
            `<li><button type="button" class="w3-button w3-small w3-white" data-history="${entry.index}">${escapeHtml(formatWhen(entry.savedAt))}</button> <span class="w3-text-grey w3-small">schema ${entry.schemaVersion} · ${entry.bytes} bytes</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="w3-text-grey">No earlier copy yet. The next save appends this file.</p>`;
  return `<section class="editor-history">
    <h2 class="w3-medium">History</h2>
    <p class="w3-text-grey">One file, <code>${escapeHtml(payload.historyFile)}</code>. Each save appends the previous raw YAML. The published snapshot keeps only the current page.</p>
    ${list}
    <pre id="history-view" class="w3-code editor-history-raw" hidden></pre>
  </section>`;
}

function formatWhen(savedAt: string): string {
  return savedAt.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function saveNotice(saved: SaveResult): string {
  const published = saved.snapshot ? ` Published snapshot ${saved.snapshot.file}.` : "";
  if (saved.historyAppended) {
    return `Saved. Appended the previous file to history (${saved.historyCount} ${saved.historyCount === 1 ? "version" : "versions"}).${published}`;
  }
  return `Saved.${published}`;
}

async function showHistory(root: HTMLElement, kind: string, id: string, index: number): Promise<void> {
  const view = root.querySelector<HTMLElement>("#history-view");
  if (!view) return;
  view.hidden = false;
  view.textContent = "Loading…";
  try {
    const entry = await getHistoryEntry(kind, id, index);
    view.textContent = `# ${formatWhen(entry.savedAt)} · schema ${entry.schemaVersion}\n\n${entry.raw}`;
  } catch (err) {
    view.textContent = err instanceof Error ? err.message : "Could not load history.";
  }
}

function fieldsHtml(data: unknown, layout?: PageLayoutHint): string {
  if (Array.isArray(data)) {
    return yamlField("_yaml", "Entries", data, 16);
  }
  if (!data || typeof data !== "object") {
    return yamlField("_yaml", "Data", data, 12);
  }
  const record = data as Record<string, unknown>;
  const meta = Object.entries(record)
    .filter(([key]) => key !== "zones")
    .map(([key, value]) => fieldFor(key, value, key))
    .join("");
  const zones =
    record.zones && typeof record.zones === "object" && !Array.isArray(record.zones)
      ? (record.zones as Record<string, unknown>)
      : {};
  return `${meta}${layoutBanner(layout)}${zoneFields(zones, layout)}`;
}

function fieldFor(key: string, value: unknown, path: string): string {
  if (key === "id") {
    return `<p><label>Id</label><input class="w3-input w3-border w3-margin-top" value="${escapeHtml(String(value ?? ""))}" disabled /></p>
      <input type="hidden" name="${escapeHtml(path)}" value="${escapeHtml(String(value ?? ""))}" />`;
  }
  if (key === "title" && typeof value === "string") {
    return textField(path, "Title", value);
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

function layoutBanner(layout?: PageLayoutHint): string {
  if (!layout) return "";
  const via =
    layout.layoutSource === "page"
      ? "page override"
      : layout.layoutSource === "section"
        ? `section ${layout.sectionId ?? ""}`.trim()
        : "site default";
  const title = layout.layoutTitle ?? layout.layoutId;
  return `<p class="w3-text-grey">Zones from layout <strong>${escapeHtml(title)}</strong> (${escapeHtml(via)}).</p>`;
}

function zoneFields(zones: Record<string, unknown>, layout?: PageLayoutHint): string {
  const declared = layout?.declaredZones ?? [];
  const declaredSet = new Set(declared);
  const onNames = declared.length ? declared : Object.keys(zones);
  const off = declared.length ? Object.keys(zones).filter((name) => !declaredSet.has(name)) : [];
  const onLayout = onNames.map((name) => zoneEditor(name, zones[name], false));
  const offLayout = off.map((name) => zoneEditor(name, zones[name], true));
  return `${onLayout.join("")}${
    offLayout.length
      ? `<section class="editor-off-layout">
        <h2 class="w3-medium">Off layout</h2>
        <p class="w3-text-grey">On this page but not declared by the layout. Still saved as data (for components).</p>
        ${offLayout.join("")}
      </section>`
      : ""
  }`;
}

function zoneEditor(name: string, zone: unknown, offLayout: boolean): string {
  const label = offLayout
    ? `Off layout: ${name}`
    : name === "main"
      ? "Body"
      : `Zone: ${name}`;
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "html" in zone) {
    const large = name === "main" || name === "minutes" || name === "hero";
    return textareaField(`zones.${name}.html`, label, String((zone as { html: unknown }).html ?? ""), large ? 18 : 6);
  }
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "json" in zone) {
    return jsonZoneFields(name, (zone as { json: unknown }).json, offLayout);
  }
  if (zone === undefined) {
    return textareaField(`zones.${name}.html`, label, "", name === "main" || name === "hero" ? 18 : 6);
  }
  return yamlField(`zones.${name}`, label, zone, 8);
}

function jsonZoneFields(name: string, json: unknown, offLayout = false): string {
  const legend = offLayout ? `Off layout: ${name}` : labelize(name);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const entries = Object.entries(json as Record<string, unknown>);
    if (entries.every(([, v]) => v === undefined || ["string", "number", "boolean"].includes(typeof v))) {
      return `<fieldset class="editor-fieldset${offLayout ? " editor-off-layout-fields" : ""}"><legend>${escapeHtml(legend)}</legend>${entries
        .map(([k, v]) => textField(`zones.${name}.json.${k}`, labelize(k), String(v ?? "")))
        .join("")}</fieldset>`;
    }
  }
  return yamlField(`zones.${name}.json`, legend, json, 8);
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

function pruneEmptyHtmlZones(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return data;
  const next: Record<string, unknown> = {};
  for (const [id, zone] of Object.entries(zones as Record<string, unknown>)) {
    if (
      zone &&
      typeof zone === "object" &&
      !Array.isArray(zone) &&
      "html" in zone &&
      !("json" in zone) &&
      !("blocks" in zone) &&
      !("component" in zone) &&
      String((zone as { html: unknown }).html ?? "").trim() === ""
    ) {
      continue;
    }
    next[id] = zone;
  }
  return { ...record, zones: next };
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
