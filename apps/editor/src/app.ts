import { stringify as stringifyYaml } from "yaml";
import { version as tesseraVersion } from "../../../package.json";
import {
  ApiError,
  createBackup,
  deleteBackup,
  deleteLibraryAsset,
  deleteLibraryFolder,
  getHistoryEntry,
  getLibrary,
  getRecord,
  listBackups,
  listRecords,
  login,
  logout,
  me,
  restoreBackup,
  initSite,
  publishSite,
  renderSite,
  restoreExample,
  saveRawRecord,
  saveRecord,
  updateLibraryAsset,
  updateLibraryFolder,
  uploadLibrary,
  createLibraryFolder,
  type BackupList,
  type PublicUser,
  type PageLayoutHint,
  type RecordList,
  type RecordPayload,
  type RecordSummary,
  type PublishResult,
  type RenderResult,
  type SaveResult,
} from "./api";
import { mountComposeCanvases } from "./compose/canvas.js";
import { readContentDraft, composeFormInner, htmlByZone, rawText, templateBodyLayout, type ContentMode } from "./compose/view.js";
import { readFormValues, renderForm } from "./forms/form.js";
import {
  applyNavAction,
  isNavAction,
  navEntries,
  navRows,
  renderNavList,
  rowsFromControls,
  type ControlValue,
  type PageChoice,
} from "./forms/nav.js";
import { newPageBody, newTemplateBody, pageFromTemplate, pageIdError, withSidebarLink } from "./forms/page.js";
import { authoredSchema, schemaFor } from "./forms/schema.js";
import { assetDetail, renderLibrary } from "./forms/library.js";
import {
  checkedFolderIds,
  documentLink,
  folderChecklist,
  foldersValue,
  imageSlideSnippet,
  imageTag,
  mediaBlockSnippet,
  renderPicker,
  type PickerMode,
  type PickedAsset,
} from "./forms/picker.js";
import { paintSpecimen, previewStyle, readStyleForm, stylesPageHtml } from "./styles-page.js";

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
      <a class="w3-bar-item w3-button" href="#/library">Library</a>
      <a class="w3-bar-item w3-button" href="#/backups">Backups</a>
      <a class="w3-bar-item w3-button" href="#/styles">Styles</a>
      <button type="button" class="w3-bar-item w3-button" data-action="render-site">Render site</button>
      <button type="button" class="w3-bar-item w3-button" data-action="publish-site">Publish</button>
      <span class="w3-bar-item w3-small">${escapeHtml(user.username)}</span>
      <button type="button" class="w3-bar-item w3-button w3-right" data-action="logout">Sign out</button>
    </header>
    <p id="render-status" class="editor-render-status" hidden></p>
    <main class="editor-main${wide ? " editor-wide" : ""}">${inner}</main>
    ${editorFooter()}`;
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
    </form></main>
    ${editorFooter()}`;
}

function editorFooter(): string {
  return `<footer class="editor-footer"><span class="editor-footer-version">v${escapeHtml(tesseraVersion)}</span></footer>`;
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
  const pending = pendingEdit;
  pendingEdit = undefined;
  try {
    if (route.kind === "backups") await bindBackups(root, user);
    else if (route.kind === "styles") await bindStyles(root, user);
    else if (route.kind === "library") await bindLibrary(root, user, route.id && route.id !== "library" ? route.id : null);
    else if (!route.kind || !route.id) await bindList(root, user);
    else {
      const mode = editsBody(route.kind) ? (pending?.mode ?? "compose") : "fields";
      await bindEdit(root, user, route.kind, route.id, mode, pending?.notice ?? "");
    }
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

const previewUrl = "/preview/";

type EditMode = "compose" | "fields" | "raw";

/** Set just before opening a newly created page, so that page starts on Compose. */
let pendingEdit: { mode: EditMode; notice: string } | undefined;

type ContentSession = {
  key: string;
  payload: RecordPayload;
  draft: Record<string, unknown>;
  fromEditor: boolean;
};

/** Unsaved content page. Tab changes read and write this instead of the saved file. */
let contentSession: ContentSession | undefined;

function bindChrome(root: HTMLElement): void {
  root.querySelector("[data-action=logout]")?.addEventListener("click", async () => {
    await logout().catch(() => undefined);
    window.location.hash = "";
    bindLogin(root);
  });
  root.querySelector("[data-action=render-site]")?.addEventListener("click", () => {
    void runRender(root);
  });
  root.querySelector("[data-action=publish-site]")?.addEventListener("click", () => {
    void runPublish(root);
  });
}

async function bindStyles(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listRecords();
  const site = listing.records.find((row) => row.kind === "site");
  if (!site) {
    root.innerHTML = chrome(
      user,
      `<h1 class="w3-large">Styles</h1><p>This site has no site record yet.</p>`,
      true,
    );
    bindChrome(root);
    return;
  }
  const payload = await getRecord("site", site.id);
  const record =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};
  root.innerHTML = chrome(user, stylesPageHtml(record, notice, error), true);
  bindChrome(root);
  const form = root.querySelector<HTMLFormElement>("#style-form");
  if (!form) return;
  const paint = () => paintSpecimen(root, previewStyle(form));
  form.addEventListener("input", paint);
  form.addEventListener("change", paint);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = readStyleForm(form);
    if (!read.ok) {
      void bindStyles(root, user, "", read.error);
      return;
    }
    void (async () => {
      try {
        await saveRecord("site", site.id, { ...record, style: read.style });
        await bindStyles(root, user, "Saved styles.");
      } catch (err) {
        await bindStyles(root, user, "", err instanceof Error ? err.message : "Could not save styles.");
      }
    })();
  });
}

async function runRender(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>("[data-action=render-site]");
  const publish = root.querySelector<HTMLButtonElement>("[data-action=publish-site]");
  const status = root.querySelector<HTMLElement>("#render-status");
  if (button) button.disabled = true;
  if (publish) publish.disabled = true;
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
    if (publish) publish.disabled = false;
  }
}

function renderNotice(result: RenderResult): string {
  const pages = `${result.pages} ${result.pages === 1 ? "page" : "pages"}`;
  const snapshot = result.snapshot ? ` Snapshot ${result.snapshot.file}.` : "";
  return `Rendered ${pages} into the preview.${snapshot} Reload ${previewUrl} to see it.`;
}

async function runPublish(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>("[data-action=publish-site]");
  const render = root.querySelector<HTMLButtonElement>("[data-action=render-site]");
  const status = root.querySelector<HTMLElement>("#render-status");
  if (button) button.disabled = true;
  if (render) render.disabled = true;
  if (status) {
    status.hidden = false;
    status.className = "editor-render-status w3-pale-yellow";
    status.textContent = "Publishing the copyable site…";
  }
  try {
    const result = await publishSite();
    if (status) {
      status.className = "editor-render-status w3-pale-green";
      status.textContent = publishNotice(result);
    }
  } catch (err) {
    if (status) {
      status.className = "editor-render-status w3-pale-red";
      status.textContent = err instanceof Error ? err.message : "Publish failed.";
    }
  } finally {
    if (button) button.disabled = false;
    if (render) render.disabled = false;
  }
}

function publishNotice(result: PublishResult): string {
  if (result.dist.flavour === "pages") {
    const count = result.dist.pages ?? 0;
    return `Published ${count} HTML ${count === 1 ? "file" : "files"} to publish/. Copy that folder to the live host.`;
  }
  const file = result.dist.snapshot ? ` ${result.dist.snapshot.file}.` : "";
  return `Published the snapshot dist to publish/.${file} Copy that folder to the live host.`;
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

async function bindList(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listRecords();
  root.innerHTML = chrome(user, listHtml(listing, notice, error), true);
  bindChrome(root);
  root.querySelector("[data-action=init-site]")?.addEventListener("click", () => {
    void (async () => {
      const button = root.querySelector<HTMLButtonElement>("[data-action=init-site]");
      if (button) button.disabled = true;
      try {
        await initSite();
        await bindList(root, user, "Started an empty site with a master layout and a home page.");
      } catch (err) {
        await bindList(root, user, "", err instanceof Error ? err.message : "Could not start a site.");
      }
    })();
  });
  root.querySelector("[data-action=new-page]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-page-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-page-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-page-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createPage(root, user, listing);
  });
  root.querySelector("[data-action=new-template]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-template-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-template-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-template-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createTemplate(root, user, listing);
  });
}

async function createPage(root: HTMLElement, user: PublicUser, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-page-form");
  if (!form) return;
  const id = form.querySelector<HTMLInputElement>("#new-page-id")?.value ?? "";
  const title = form.querySelector<HTMLInputElement>("#new-page-title")?.value ?? "";
  const sidebar = form.querySelector<HTMLInputElement>("[name=sidebar]")?.checked ?? false;
  const existing = listing.records.filter((row) => row.kind === "content").map((row) => row.id);
  const problem = pageIdError(id, existing);
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const pageId = id.trim();
  const pageTitle = title.trim() || pageId;
  const templateId = form.querySelector<HTMLSelectElement>("#new-page-template")?.value ?? "";
  try {
    const body = templateId
      ? pageFromTemplate(pageId, pageTitle, templateId, await templateRecord(templateId))
      : newPageBody(pageId, pageTitle);
    await saveRecord("content", pageId, body);
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the page.");
    if (button) button.disabled = false;
    return;
  }
  let notice = `Created ${pageTitle}.`;
  if (sidebar) {
    try {
      const nav = await getRecord("nav", "nav");
      const linked = withSidebarLink(nav.data, pageId, pageTitle);
      if (!linked.ok) notice = `Created ${pageTitle}. ${linked.message}`;
      else await saveRecord("nav", "nav", linked.nav);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add it to the sidebar.";
      notice = `Created ${pageTitle}. ${message}`;
    }
  }
  pendingEdit = { mode: "compose", notice };
  const hash = `#/content/${encodeURIComponent(pageId)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

async function templateRecord(id: string): Promise<Record<string, unknown>> {
  const payload = await getRecord("templates", id);
  const data = asRecord(payload.data);
  if (!data) throw new Error("That template could not be read.");
  return data;
}

async function createTemplate(root: HTMLElement, user: PublicUser, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-template-form");
  if (!form) return;
  const id = form.querySelector<HTMLInputElement>("#new-template-id")?.value ?? "";
  const title = form.querySelector<HTMLInputElement>("#new-template-title")?.value ?? "";
  const existing = listing.records.filter((row) => row.kind === "templates").map((row) => row.id);
  const problem = pageIdError(id, existing);
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const templateId = id.trim();
  const templateTitle = title.trim() || templateId;
  try {
    await saveRecord("templates", templateId, newTemplateBody(templateId, templateTitle));
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the template.");
    if (button) button.disabled = false;
    return;
  }
  pendingEdit = { mode: "compose", notice: `Created ${templateTitle}.` };
  const hash = `#/templates/${encodeURIComponent(templateId)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

function showNewPageError(form: HTMLFormElement, message: string): void {
  const error = form.querySelector<HTMLElement>("[data-form-error]");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

async function contentPages(): Promise<PageChoice[]> {
  const listing = await listRecords();
  return listing.records
    .filter((row) => row.kind === "content")
    .map((row) => ({ id: row.id, title: row.title }));
}

function bindNavEditor(form: HTMLFormElement, pages: PageChoice[]): void {
  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement) || !form.contains(button)) return;
    const action = button.dataset.navAction;
    if (!action || !isNavAction(action)) return;
    const editor = form.querySelector<HTMLElement>("#nav-editor");
    if (!editor) return;
    event.preventDefault();
    const rows = applyNavAction(
      rowsFromControls(navControls(form)),
      action,
      Number(button.dataset.navIndex ?? 0),
      Number(button.dataset.navChild ?? 0),
    );
    editor.innerHTML = renderNavList(rows, pages);
  });
}

function navControls(form: HTMLFormElement): ControlValue[] {
  const controls: ControlValue[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      continue;
    }
    if (!el.name.startsWith("nav-")) continue;
    controls.push({
      name: el.name,
      value: el.value,
      checked: el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : undefined,
    });
  }
  return controls;
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
    <p class="w3-text-grey">Willow is a <code>.tar.gz</code> in that same backup folder. Restoring it fills this empty site. Your editors stay. A new site can also start blank from the editor.</p>
    ${examples}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function listHtml(listing: RecordList, notice = "", error = ""): string {
  const byKind = new Map<string, RecordSummary[]>();
  for (const rec of listing.records) {
    const list = byKind.get(rec.kind) ?? [];
    list.push(rec);
    byKind.set(rec.kind, list);
  }
  const empty = !listing.records.some((row) => row.kind === "site");
  const hidden = new Set(["media", "folders"]);
  const sections = listing.kinds
    .filter((kind) => !hidden.has(kind.kind))
    .map((kind) => {
      const rows = byKind.get(kind.kind) ?? [];
      if (kind.kind === "content" && !empty) return contentSection(kind.label, rows, byKind.get("templates") ?? []);
      if (kind.kind === "templates" && !empty) return templateSection(kind.label, rows);
      if (!rows.length) return "";
      return kindSection(kind.label, rows);
    })
    .join("");
  const start = empty
    ? `<p><button type="button" class="w3-button w3-theme" data-action="init-site">Start an empty site</button></p>
       <p class="w3-text-grey">This writes a shell, a master layout, a page layout, and a home page into the instance directory. It does not replace a site that already has records.</p>`
    : "";
  return `<h1 class="w3-large">Records</h1>
    ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
    ${error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : ""}
    <p class="w3-text-grey">YAML files named with Tessera <code>id</code>, outside the web root. Saving a page appends the previous file to a history file and refreshes the SPA preview at <code>/preview/</code>. <strong>Render site</strong> rebuilds that preview for every page. <strong>Publish</strong> writes the copyable <code>publish/</code> folder, and leaves it alone until the next time you publish.</p>
    <p><a class="w3-button w3-theme" href="#/library">Library</a></p>
    ${start}
    ${sections || (empty ? "" : "<p>No records yet.</p>")}`;
}

function kindSection(label: string, rows: RecordSummary[]): string {
  return `<section class="editor-kind">
    <h2 class="w3-medium">${escapeHtml(label)}</h2>
    ${recordList(rows)}
  </section>`;
}

function contentSection(label: string, rows: RecordSummary[], templates: RecordSummary[]): string {
  const options = templates
    .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.title ?? row.id)}</option>`)
    .join("");
  return `<section class="editor-kind">
    <h2 class="w3-medium">${escapeHtml(label)}</h2>
    <p><button type="button" class="w3-button w3-theme" data-action="new-page">New page</button></p>
    <form id="new-page-form" class="editor-new-page" hidden>
      <p><label for="new-page-id">Id</label>
        <input id="new-page-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p class="w3-text-grey">This becomes the page address and the filename. Start with a letter or number, then letters, numbers, dots, hyphens, or underscores.</p>
      <p><label for="new-page-title">Title</label>
        <input id="new-page-title" name="title" class="w3-input w3-border w3-margin-top" required />
      </p>
      <p><label for="new-page-template">Template</label>
        <select id="new-page-template" name="template" class="w3-select w3-border w3-margin-top">
          <option value="">Free form</option>
          ${options}
        </select>
      </p>
      <p class="w3-text-grey">Free form starts empty and can be rearranged. A template copies that prototype, including its placeholder text.</p>
      <p class="editor-check"><label><input name="sidebar" type="checkbox" checked /> Include in the sidebar</label></p>
      <p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Create page</button></p>
    </form>
    ${rows.length ? recordList(rows) : ""}
  </section>`;
}

function templateSection(label: string, rows: RecordSummary[]): string {
  return `<section class="editor-kind">
    <h2 class="w3-medium">${escapeHtml(label)}</h2>
    <p><button type="button" class="w3-button w3-theme" data-action="new-template">New template</button></p>
    <form id="new-template-form" class="editor-new-page" hidden>
      <p><label for="new-template-id">Id</label>
        <input id="new-template-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p class="w3-text-grey">One file, <code>records/templates/&lt;id&gt;.yaml</code>. Copy that file to reuse the template on another site.</p>
      <p><label for="new-template-title">Title</label>
        <input id="new-template-title" name="title" class="w3-input w3-border w3-margin-top" required />
      </p>
      <p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Create template</button></p>
    </form>
    ${rows.length ? recordList(rows) : ""}
  </section>`;
}

function editsBody(kind: string | undefined): boolean {
  return kind === "content" || kind === "templates";
}

function recordList(rows: RecordSummary[]): string {
  return `<ul class="w3-ul">
    ${rows
      .map(
        (row) =>
          `<li><a href="#/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}">${escapeHtml(row.title ?? row.id)}</a> <span class="w3-text-grey w3-small">${escapeHtml(row.id)}</span></li>`,
      )
      .join("")}
  </ul>`;
}

async function bindEdit(
  root: HTMLElement,
  user: PublicUser,
  kind: string,
  id: string,
  mode: EditMode,
  notice = "",
  keepDraft = false,
): Promise<void> {
  const key = `${kind}/${id}`;
  let payload: RecordPayload;
  if (editsBody(kind) && keepDraft && contentSession?.key === key) {
    payload = contentSession.payload;
  } else {
    payload = await getRecord(kind, id);
    const loaded = asRecord(payload.data);
    if (editsBody(kind) && loaded) {
      contentSession = { key, payload, draft: structuredClone(loaded), fromEditor: false };
    } else if (editsBody(kind)) {
      contentSession = undefined;
    }
  }
  const session = editsBody(kind) ? contentSession : undefined;
  const record = session?.draft ?? asRecord(payload.data);
  const rawShown = session ? rawText(session.fromEditor, session.draft, payload.raw) : payload.raw;
  const editMode: EditMode = mode === "compose" && !editsBody(kind) ? "fields" : mode;
  const bodyLayout = kind === "templates" ? templateBodyLayout() : payload.layout;
  const navList = kind === "nav" && editMode === "fields" && Array.isArray(payload.data);
  const pages: PageChoice[] = navList ? await contentPages() : [];
  const navNote =
    kind === "nav" && editMode === "fields" && !Array.isArray(payload.data)
      ? `<p class="w3-text-grey">This navigation file is not a list. Edit it as YAML, or switch to Raw file.</p>`
      : "";
  const galleryFolders = kind === "bindings" ? await galleryFolderRows() : [];
  const formInner =
    editMode === "raw"
      ? `<p><label for="raw-file">Raw YAML</label>
         <textarea id="raw-file" name="raw" rows="24" spellcheck="false" class="w3-input w3-border w3-margin-top editor-raw">${escapeHtml(rawShown)}</textarea></p>`
      : editMode === "compose" && record
        ? composeFormInner(kind, record, bodyLayout)
      : navList
        ? `<div id="nav-editor">${renderNavList(navRows(payload.data), pages)}</div>`
        : `${navNote}${fieldsHtml(kind, record ?? payload.data, payload.layout, galleryFolders)}`;
  root.innerHTML = chrome(
    user,
    `<p><a href="#/">← Records</a></p>
     <h1 class="w3-large">${escapeHtml(kind)} / ${escapeHtml(id)}</h1>
     ${lifecycleHtml(payload)}
     ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
     <p class="editor-tabs">
       ${
         editsBody(kind)
           ? `<button type="button" class="w3-button ${editMode === "compose" ? "w3-theme" : "w3-white"}" data-mode="compose">Compose</button>`
           : ""
       }
       <button type="button" class="w3-button ${editMode === "fields" ? "w3-theme" : "w3-white"}" data-mode="fields">Fields</button>
       <button type="button" class="w3-button ${editMode === "raw" ? "w3-theme" : "w3-white"}" data-mode="raw">Raw file</button>
     </p>
     <p class="w3-text-grey"><code>${escapeHtml(payload.file)}</code></p>
     <form id="record-form" class="w3-card w3-white w3-padding-large editor-card">
       ${formInner}
       <p id="save-status" class="w3-text-grey" hidden></p>
       <p class="editor-actions"><button type="submit" class="w3-button w3-theme">Save</button>${
         editsBody(kind)
           ? `<button type="button" class="w3-button w3-white" data-action="revert">Revert</button>`
           : ""
       }</p>
     </form>
     ${historyHtml(payload)}`,
    true,
  );
  bindChrome(root);
  if (editMode === "compose") root.querySelector(".editor-main")?.classList.add("editor-compose");
  const form = root.querySelector<HTMLFormElement>("#record-form");
  if (form && editMode === "compose" && record) await mountPageCanvas(form, record, bodyLayout);
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode;
      if (next !== "compose" && next !== "fields" && next !== "raw") return;
      if (next === editMode) return;
      if (editsBody(kind) && contentSession && form) {
        const taken = readContentDraft(form, editMode, contentSession.draft, contentSession.payload.raw, contentSession.payload.data, kind);
        if (!taken.ok) {
          showSaveError(root, taken.error);
          return;
        }
        if (!taken.unchanged) {
          contentSession.draft = taken.draft;
          contentSession.fromEditor = taken.fromEditor;
        }
        void bindEdit(root, user, kind, id, next, "", true);
        return;
      }
      void bindEdit(root, user, kind, id, next === "compose" ? "fields" : next);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-history]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.history);
      void showHistory(root, kind, id, index);
    });
  }
  if (form && navList) bindNavEditor(form, pages);
  if (form) bindPickers(form);
  form?.addEventListener("input", () => {
    form.dataset.dirty = "true";
  });
  form?.addEventListener("change", () => {
    form.dataset.dirty = "true";
  });
  form?.querySelector<HTMLButtonElement>("[data-action=revert]")?.addEventListener("click", () => {
    if (!window.confirm("Discard unsaved edits and restore the last saved file?")) return;
    contentSession = undefined;
    void bindEdit(root, user, kind, id, editMode);
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button) (button as HTMLButtonElement).disabled = true;
    try {
      let saved;
      if (editsBody(kind) && contentSession && (editMode === "compose" || editMode === "fields" || editMode === "raw")) {
        const taken = readContentDraft(form, editMode, contentSession.draft, contentSession.payload.raw, contentSession.payload.data, kind);
        if (!taken.ok) {
          showSaveError(root, taken.error);
          if (button) (button as HTMLButtonElement).disabled = false;
          return;
        }
        if (!taken.unchanged) {
          contentSession.draft = taken.draft;
          contentSession.fromEditor = taken.fromEditor;
        }
        saved =
          editMode === "raw"
            ? await saveRawRecord(kind, id, form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "")
            : await saveRecord(kind, id, pruneEmptyHtmlZones(contentSession.draft));
      } else {
        saved =
          editMode === "raw"
            ? await saveRawRecord(kind, id, form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "")
            : await saveRecord(
                kind,
                id,
                navList
                  ? navEntries(rowsFromControls(navControls(form)))
                  : saveRecordBody(kind, form, payload.data),
              );
      }
      await bindEdit(root, user, kind, id, editMode, saveNotice(saved));
    } catch (err) {
      showSaveError(root, err instanceof Error ? err.message : "Save failed.");
      if (button) (button as HTMLButtonElement).disabled = false;
    }
  });
}

function showSaveError(root: HTMLElement, message: string): void {
  const statusEl = root.querySelector<HTMLElement>("#save-status");
  if (!statusEl) return;
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = "w3-pale-red w3-padding";
}

async function mountPageCanvas(
  form: HTMLFormElement,
  record: Record<string, unknown>,
  layout: PageLayoutHint | undefined,
): Promise<void> {
  let bindings: { id: string; title?: string }[] = [];
  let folders: { id: string; title?: string }[] = [];
  try {
    const listing = await listRecords();
    bindings = listing.records
      .filter((row) => row.kind === "bindings")
      .map((row) => ({ id: row.id, title: row.title }));
    folders = listing.records
      .filter((row) => row.kind === "folders")
      .map((row) => ({ id: row.id, title: row.title }));
  } catch {
    bindings = [];
    folders = [];
  }
  if (!form.isConnected) return;
  mountComposeCanvases(form, {
    bindings,
    folders,
    htmlByZone: htmlByZone(record, layout),
    locked: record.locked === true,
  });
}

function asRecord(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  return data as Record<string, unknown>;
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
  const snapshot = saved.snapshot ? ` Snapshot ${saved.snapshot.file}.` : "";
  if (saved.historyAppended) {
    return `Saved. Appended the previous file to history (${saved.historyCount} ${saved.historyCount === 1 ? "version" : "versions"}).${snapshot}`;
  }
  return `Saved.${snapshot}`;
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

function fieldsHtml(
  kind: string,
  data: unknown,
  layout?: PageLayoutHint,
  galleryFolders: { id: string; title: string; parentId: string | null }[] = [],
): string {
  if (Array.isArray(data) || !data || typeof data !== "object") {
    return renderForm(
      { fields: [{ name: "_yaml", label: Array.isArray(data) ? "Entries" : "Data", type: "yaml", rows: Array.isArray(data) ? 16 : 12 }] },
      { _yaml: data },
    );
  }
  const record = data as Record<string, unknown>;
  if (kind === "bindings") return bindingFields(record, galleryFolders);
  const schema = schemaFor(kind, record);
  if (!schema) {
    return renderForm({ fields: [{ name: "_yaml", label: "Data", type: "yaml", rows: 12 }] }, { _yaml: data });
  }
  const authoredNames = new Set((authoredSchema(kind)?.fields ?? schema.fields).map((field) => field.name));
  const base = schema.fields.filter((field) => authoredNames.has(field.name));
  const extras = schema.fields.filter((field) => !authoredNames.has(field.name));
  const zones =
    kind === "content"
      ? `${layoutBanner(layout)}${zoneFields(zonesOf(record), layout)}`
      : "";
  return `${renderForm({ fields: base }, record)}${zones}${extras.length ? renderForm({ fields: extras }, record) : ""}`;
}

function zonesOf(record: Record<string, unknown>): Record<string, unknown> {
  return record.zones && typeof record.zones === "object" && !Array.isArray(record.zones)
    ? (record.zones as Record<string, unknown>)
    : {};
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
    return `${insertButtons(`zones.${name}.html`, "html")}${textareaField(`zones.${name}.html`, label, String((zone as { html: unknown }).html ?? ""), large ? 18 : 6)}`;
  }
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "json" in zone) {
    return jsonZoneFields(name, (zone as { json: unknown }).json, offLayout);
  }
  if (zone === undefined) {
    return `${insertButtons(`zones.${name}.html`, "html")}${textareaField(`zones.${name}.html`, label, "", name === "main" || name === "hero" ? 18 : 6)}`;
  }
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "blocks" in zone) {
    return `${insertButtons(`zones.${name}`, "blocks")}${yamlField(`zones.${name}`, label, zone, 8)}`;
  }
  return yamlField(`zones.${name}`, label, zone, 8);
}

function jsonZoneFields(name: string, json: unknown, offLayout = false): string {
  const legend = offLayout ? `Off layout: ${name}` : labelize(name);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const entries = Object.entries(json as Record<string, unknown>);
    if (entries.every(([, v]) => v === undefined || ["string", "number", "boolean"].includes(typeof v))) {
      return `<fieldset class="editor-fieldset${offLayout ? " editor-off-layout-fields" : ""}"><legend>${escapeHtml(legend)}</legend>${entries
        .map(([k, v]) => {
          const field = textField(`zones.${name}.json.${k}`, labelize(k), String(v ?? ""));
          return typeof v === "string" || v === undefined
            ? `${field}<p><button type="button" class="w3-button w3-small w3-white" data-insert="id" data-target="${escapeHtml(`zones.${name}.json.${k}`)}">Library</button></p>`
            : field;
        })
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

async function galleryFolderRows(): Promise<{ id: string; title: string; parentId: string | null }[]> {
  try {
    const listing = await getLibrary();
    return listing.folders;
  } catch {
    return [];
  }
}

function bindingFields(
  record: Record<string, unknown>,
  folders: { id: string; title: string; parentId: string | null }[],
): string {
  const props =
    record.props && typeof record.props === "object" && !Array.isArray(record.props)
      ? { ...(record.props as Record<string, unknown>) }
      : {};
  const raw = props.folders ?? props.folder;
  const selected = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string")
    : typeof raw === "string"
      ? [raw]
      : [];
  delete props.folders;
  delete props.folder;
  const shown = { ...record, props };
  const schema = schemaFor("bindings", shown);
  const form = schema ? renderForm(schema, shown) : "";
  const usePicker = record.component === "gallery" || raw !== undefined;
  if (!usePicker) return form;
  return `${form}<fieldset class="editor-fieldset"><legend>Gallery folders</legend>${folderChecklist(folders, selected)}</fieldset>`;
}

function saveRecordBody(kind: string, form: HTMLFormElement, original: unknown): unknown {
  const data = pruneEmptyHtmlZones(readFormValues(form, schemaFor(kind, original), original));
  if (kind !== "bindings" || !form.querySelector("[data-folder-id]")) return data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const props =
    record.props && typeof record.props === "object" && !Array.isArray(record.props)
      ? { ...(record.props as Record<string, unknown>) }
      : {};
  const ids = checkedFolderIds(
    [...form.querySelectorAll<HTMLInputElement>("[data-folder-id]")].map((el) => ({
      id: el.dataset.folderId ?? "",
      checked: el.checked,
    })),
  );
  const value = foldersValue(ids);
  delete props.folder;
  if (value === undefined) delete props.folders;
  else props.folders = value;
  record.props = props;
  return record;
}

function insertButtons(target: string, kind: "html" | "blocks"): string {
  const name = escapeHtml(target);
  if (kind === "html") {
    return `<p><button type="button" class="w3-button w3-small w3-white" data-insert="image" data-target="${name}">Image</button>
      <button type="button" class="w3-button w3-small w3-white" data-insert="document" data-target="${name}">Document</button></p>`;
  }
  return `<p><button type="button" class="w3-button w3-small w3-white" data-insert="media-image" data-target="${name}">Image</button>
    <button type="button" class="w3-button w3-small w3-white" data-insert="media-document" data-target="${name}">Document</button>
    <button type="button" class="w3-button w3-small w3-white" data-insert="slide" data-target="${name}">Image slide</button></p>`;
}

function bindPickers(form: HTMLFormElement): void {
  form.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    if (button.dataset.insert && button.dataset.target) {
      event.preventDefault();
      void insertFromLibrary(form, button.dataset.insert, button.dataset.target);
    }
    if (button.dataset.library === "image") {
      event.preventDefault();
      void fillImageBox(button);
    }
  });
}

async function insertFromLibrary(form: HTMLFormElement, insert: string, target: string): Promise<void> {
  const mode: PickerMode = insert === "document" || insert === "media-document" ? "document" : "image";
  const picked = await openLibraryPicker(insert === "id" ? "image" : mode);
  if (!picked) return;
  const control = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${CSS.escape(target)}"]`);
  if (insert === "id") {
    if (control instanceof HTMLInputElement) {
      control.value = picked.id;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      form.dataset.dirty = "true";
    }
    return;
  }
  if (!("url" in picked) || !(control instanceof HTMLTextAreaElement)) return;
  const text =
    insert === "document"
      ? documentLink(picked)
      : insert === "slide"
        ? imageSlideSnippet(picked)
        : insert === "media-image" || insert === "media-document"
          ? mediaBlockSnippet(picked)
          : imageTag(picked);
  insertAtCursor(control, text);
  form.dataset.dirty = "true";
}

async function fillImageBox(button: HTMLButtonElement): Promise<void> {
  const picked = await openLibraryPicker("image");
  if (!picked || !("url" in picked)) return;
  const scope = button.closest("[data-item-id]") ?? button.parentElement;
  const src = scope?.querySelector<HTMLInputElement>('[data-field="src"]');
  const alt = scope?.querySelector<HTMLInputElement>('[data-field="alt"]');
  if (src) {
    src.value = picked.url;
    src.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (alt && !alt.value) {
    alt.value = picked.alt || picked.title || picked.name;
    alt.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function openLibraryPicker(initial: PickerMode): Promise<PickedAsset | { id: string; kind: "folder" } | undefined> {
  return getLibrary().then(
    (listing) =>
      new Promise((resolve) => {
        const host = document.createElement("div");
        host.className = "editor-picker-host";
        let mode = initial;
        let openId: string | null = null;
        let done = false;
        const finish = (value: PickedAsset | { id: string; kind: "folder" } | undefined) => {
          if (done) return;
          done = true;
          host.remove();
          resolve(value);
        };
        const paint = () => {
          host.innerHTML = `<div class="editor-picker-backdrop"><div class="w3-card w3-white w3-padding editor-card" role="dialog">
            <p><button type="button" class="w3-button w3-white" data-picker-close>Close</button>
            ${openId ? `<button type="button" class="w3-button w3-white" data-picker-up>Up</button>` : ""}</p>
            ${renderPicker(listing, mode, openId)}
          </div></div>`;
        };
        host.addEventListener("click", (event) => {
          const button = (event.target as HTMLElement).closest("button");
          if (!button) return;
          if (button.hasAttribute("data-picker-close")) {
            finish(undefined);
            return;
          }
          if (button.dataset.pickerMode === "image" || button.dataset.pickerMode === "document" || button.dataset.pickerMode === "folder") {
            mode = button.dataset.pickerMode;
            paint();
            return;
          }
          if (button.dataset.openFolder) {
            openId = button.dataset.openFolder;
            paint();
            return;
          }
          if (button.hasAttribute("data-picker-up")) {
            openId = listing.folders.find((folder) => folder.id === openId)?.parentId ?? null;
            paint();
            return;
          }
          if (button.dataset.pickFolder) {
            finish({ id: button.dataset.pickFolder, kind: "folder" });
            return;
          }
          const asset = listing.assets.find((item) => item.id === button.dataset.pickAsset);
          if (asset) finish(asset);
        });
        paint();
        document.body.appendChild(host);
      }),
  );
}

async function bindLibrary(root: HTMLElement, user: PublicUser, openId: string | null, notice = ""): Promise<void> {
  const listing = await getLibrary();
  root.innerHTML = chrome(user, renderLibrary(listing, openId, notice), true);
  bindChrome(root);
  const form = root.querySelector<HTMLFormElement>("#library-upload");
  let dropped: { file: File; path: string }[] = [];
  form?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  form?.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer) return;
    void readDataTransfer(event.dataTransfer).then((files) => {
      dropped = files;
      const status = form.querySelector<HTMLElement>("#library-upload-status");
      if (status) {
        status.hidden = false;
        status.textContent = `${files.length} file${files.length === 1 ? "" : "s"} ready.`;
      }
    });
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitLibraryUpload(root, user, form, openId, dropped);
    dropped = [];
  });
  root.querySelector("[data-action=new-folder]")?.addEventListener("click", () => {
    const title = window.prompt("Folder name");
    if (!title?.trim()) return;
    void createLibraryFolder(title.trim(), openId ?? undefined)
      .then(() => bindLibrary(root, user, openId, `Created ${title.trim()}.`))
      .catch((err) => bindLibrary(root, user, openId, err instanceof Error ? err.message : "Could not create the folder."));
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-delete-folder]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteFolder;
      if (!id || !window.confirm("Delete this empty folder?")) return;
      void deleteLibraryFolder(id)
        .then(() => bindLibrary(root, user, openId, "Folder deleted."))
        .catch((err) => bindLibrary(root, user, openId, err instanceof Error ? err.message : "Could not delete the folder."));
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-rename-folder]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.renameFolder;
      const current = listing.folders.find((folder) => folder.id === id);
      const title = window.prompt("Folder name", current?.title ?? "");
      if (!id || !title?.trim()) return;
      void updateLibraryFolder(id, { title: title.trim() }).then(() => bindLibrary(root, user, openId, "Folder renamed."));
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-delete-asset]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteAsset;
      if (!id || !window.confirm("Delete this file?")) return;
      void deleteLibraryAsset(id).then(() => bindLibrary(root, user, openId, "File deleted."));
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-edit-asset]")) {
    button.addEventListener("click", () => {
      const asset = listing.assets.find((item) => item.id === button.dataset.editAsset);
      if (!asset) return;
      const slot = root.querySelector(".editor-main");
      const existing = root.querySelector("#asset-detail");
      existing?.remove();
      slot?.insertAdjacentHTML("beforeend", assetDetail(asset, listing.folders));
      root.querySelector<HTMLFormElement>("#asset-detail")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const detail = event.currentTarget as HTMLFormElement;
        const name = detail.querySelector<HTMLInputElement>("[name=name]")?.value ?? "";
        void updateLibraryAsset(asset.id, {
          name,
          title: detail.querySelector<HTMLInputElement>("[name=title]")?.value ?? "",
          alt: detail.querySelector<HTMLInputElement>("[name=alt]")?.value ?? "",
          caption: detail.querySelector<HTMLInputElement>("[name=caption]")?.value ?? "",
          folderId: detail.querySelector<HTMLSelectElement>("[name=folderId]")?.value || null,
        }).then(() => bindLibrary(root, user, openId, "Saved."));
      });
    });
  }
  for (const image of root.querySelectorAll<HTMLImageElement>(".editor-thumb[data-fallback]")) {
    image.addEventListener("error", () => {
      const fallback = image.dataset.fallback;
      if (fallback && image.src !== new URL(fallback, window.location.origin).href) image.src = fallback;
    });
  }
}

async function submitLibraryUpload(
  root: HTMLElement,
  user: PublicUser,
  form: HTMLFormElement,
  openId: string | null,
  dropped: { file: File; path: string }[],
): Promise<void> {
  const dest = form.querySelector<HTMLInputElement>('input[name="dest"]:checked')?.value ?? "uploads";
  const body = new FormData();
  const files = form.querySelector<HTMLInputElement>("#library-files")?.files;
  const dir = form.querySelector<HTMLInputElement>("#library-dir")?.files;
  const chosen: { file: File; path: string }[] = dropped.length
    ? dropped
    : [...(dir && dir.length ? dir : files ?? [])].map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
      }));
  if (!chosen.length) {
    const status = form.querySelector<HTMLElement>("#library-upload-status");
    if (status) {
      status.hidden = false;
      status.textContent = "Choose at least one file.";
    }
    return;
  }
  for (const item of chosen) {
    body.append("file", item.file);
    body.append("path", item.path);
  }
  if (dest === "existing" && openId) body.append("folderId", openId);
  else if (dest === "choose") {
    const folderId = form.querySelector<HTMLSelectElement>("[name=folderId]")?.value;
    if (folderId) body.append("folderId", folderId);
  } else if (dest === "new") {
    const title = form.querySelector<HTMLInputElement>("[name=folderTitle]")?.value ?? "";
    if (!title.trim()) {
      const status = form.querySelector<HTMLElement>("#library-upload-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Name the new folder.";
      }
      return;
    }
    body.append("folderTitle", title.trim());
    if (openId) body.append("parentId", openId);
  } else body.append("folderId", "uploads");
  try {
    const result = await uploadLibrary(body);
    const skipped = result.skipped.length ? ` Skipped ${result.skipped.map((item) => item.name).join(", ")}.` : "";
    const folderId = dest === "uploads" ? "uploads" : openId;
    await bindLibrary(root, user, folderId, `Added ${result.created.length} file${result.created.length === 1 ? "" : "s"}.${skipped}`);
  } catch (err) {
    await bindLibrary(root, user, openId, err instanceof Error ? err.message : "Could not add those files.");
  }
}

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (file: File) => void) => void;
  createReader: () => { readEntries: (cb: (entries: FsEntry[]) => void) => void };
};

async function readDataTransfer(transfer: DataTransfer): Promise<{ file: File; path: string }[]> {
  const out: { file: File; path: string }[] = [];
  const items = [...transfer.items];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() as FsEntry | null;
    if (entry) await walkEntry(entry, "", out);
    else if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) out.push({ file, path: file.name });
    }
  }
  return out;
}

async function walkEntry(entry: FsEntry, prefix: string, out: { file: File; path: string }[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => entry.file(resolve));
    out.push({ file, path: `${prefix}${file.name}` });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  const children = await new Promise<FsEntry[]>((resolve) => reader.readEntries(resolve));
  for (const child of children) await walkEntry(child, `${prefix}${entry.name}/`, out);
}
