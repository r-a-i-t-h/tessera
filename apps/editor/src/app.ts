import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
  changePassword,
  changeUsername,
  createUser,
  deleteUser,
  listUsers,
  login,
  logout,
  me,
  restoreBackup,
  initSite,
  publishSite,
  renderSite,
  restoreExample,
  reseedSite,
  saveRawRecord,
  saveRecord,
  listStylesheets,
  saveStylesheet,
  updateLibraryAsset,
  updateUser,
  uploadLibrary,
  createLibraryFolder,
  type BackupList,
  type ManagedUser,
  type PublicUser,
  type PageLayoutHint,
  type RecordList,
  type RecordPayload,
  type RecordSummary,
  type PublishResult,
  type RenderResult,
  type SaveResult,
} from "./api";
import { entryVisible } from "./forms/entries.js";
import { arrangeMarkup, mountArrange, readArrangeRoot } from "./arrange/canvas.js";
import { asLayoutNode, cleanNode, isFrame, newFrame, newPageLayout } from "./arrange/tree.js";
import type { ArrangeInfo } from "./arrange/view.js";
import { mountComposeCanvases } from "./compose/canvas.js";
import { readContentDraft, composeFormInner, frameNote, htmlByZone, rawText, templateBodyLayout, type ContentMode } from "./compose/view.js";
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
import {
  applyTypeAction,
  draftFromControls,
  isTypeAction,
  newTypeBody,
  renderTypeForm,
  typeDraft,
  typeFieldError,
  typeRecord,
  type LayoutChoice,
} from "./forms/type.js";
import { authoredSchema, schemaFor, withFrameChoices, withTypeChoices } from "./forms/schema.js";
import { readDataTransfer } from "./forms/drop.js";
import { assetDetail, renderLibrary } from "./forms/library.js";
import {
  bindingIdError,
  bindingIdsIn,
  bindingKind,
  bindingSentence,
  blankNewBinding,
  datedDraftFromForm,
  datedRecord,
  galleryDraftFromForm,
  galleryRecord,
  limitError,
  linksDraftFromForm,
  linksRecord,
  navHeadings,
  newBindingError,
  newBindingRecord,
  peopleDraftFromForm,
  peopleRecord,
  readNewBinding,
  renderBindingForm,
  renderNewBinding,
  type BindingChoices,
  type NewBinding,
} from "./forms/binding.js";
import {
  checkedFolderIds,
  documentLink,
  imageSlideSnippet,
  imageTag,
  mediaBlockSnippet,
  renderPicker,
  type PickerMode,
  type PickedAsset,
} from "./forms/picker.js";
import { guideHtml } from "./guide.js";
import { paintSpecimen, previewStyle, readStyleForm, stylesheetEditors, stylesPageHtml } from "./styles-page.js";
import { usernameError } from "./username.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EditorSection = "home" | "records" | "library" | "backups" | "styles" | "guide" | "users" | "account";

function chrome(user: PublicUser, inner: string, wide = false, section: EditorSection = "home"): string {
  const link = (href: string, label: string, key: EditorSection) => {
    const current = section === key;
    return `<a class="w3-bar-item w3-button${current ? " w3-white" : ""}" href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
  };
  return `<header class="w3-bar w3-theme">
      ${link("#/", "Tessera editor", "home")}
      ${link("#/records", "Records", "records")}
      ${link("#/library", "Library", "library")}
      ${link("#/backups", "Backups", "backups")}
      ${link("#/styles", "Styles", "styles")}
      ${link("#/guide", "Guide", "guide")}
      ${link("#/users", "Users", "users")}
      <button type="button" class="w3-bar-item w3-button" data-action="render-site">Render site</button>
      <button type="button" class="w3-bar-item w3-button" data-action="publish-site">Publish</button>
      <button type="button" class="w3-bar-item w3-button w3-right" data-action="logout">Sign out</button>
      <a class="w3-bar-item w3-button w3-right${section === "account" ? " w3-white" : ""}" href="#/account" title="Account"${section === "account" ? ' aria-current="page"' : ""}>${escapeHtml(user.username)}</a>
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
    if (route.page === "account") await bindAccount(root, user);
    else if (route.page === "users") await bindUsers(root, user);
    else if (route.page === "user") await bindUser(root, user, route.username);
    else if (route.page === "backups") await bindBackups(root, user);
    else if (route.page === "styles") await bindStyles(root, user);
    else if (route.page === "guide") {
      root.innerHTML = chrome(user, guideHtml(), true, "guide");
      bindChrome(root);
    }
    else if (route.page === "library") await bindLibrary(root, user, route.id);
    else if (route.page === "records") await bindList(root, user, route.kind);
    else if (route.page === "edit") {
      const mode = initialEditMode(route.kind, pending);
      await bindEdit(root, user, route.kind, route.id, mode, pending?.notice ?? "");
    } else if (route.page === "missing") {
      root.innerHTML = chrome(
        user,
        `<h1 class="w3-large">Not found</h1><p><a href="#/">Back to the editor</a></p>`,
      );
      bindChrome(root);
    } else await bindHome(root, user);
  } catch (err) {
    root.innerHTML = chrome(
      user,
      `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(err instanceof Error ? err.message : "Error")}</p>
       <p><a href="#/">Back to the editor</a></p>`,
    );
    bindChrome(root);
  }
}

type Route =
  | { page: "home" }
  | { page: "records"; kind?: string }
  | { page: "library"; id: string | null }
  | { page: "backups" }
  | { page: "styles" }
  | { page: "guide" }
  | { page: "account" }
  | { page: "users" }
  | { page: "user"; username: string }
  | { page: "edit"; kind: string; id: string }
  | { page: "missing" };

function parseRoute(): Route {
  const path = window.location.hash.replace(/^#\/?/, "");
  if (!path) return { page: "home" };
  const slash = path.indexOf("/");
  const head = decodeURIComponent(slash === -1 ? path : path.slice(0, slash));
  const rest = slash === -1 ? "" : decodeURIComponent(path.slice(slash + 1));
  if (head === "records") {
    if (rest.includes("/")) return { page: "missing" };
    return { page: "records", kind: rest || undefined };
  }
  if (head === "site" || head === "nav") {
    if (!rest || rest.includes("/")) return { page: "missing" };
    return { page: "records", kind: head };
  }
  if (head === "library") return { page: "library", id: rest || null };
  if (head === "backups") return rest ? { page: "missing" } : { page: "backups" };
  if (head === "styles") return rest ? { page: "missing" } : { page: "styles" };
  if (head === "guide") return rest ? { page: "missing" } : { page: "guide" };
  if (head === "account") return rest ? { page: "missing" } : { page: "account" };
  if (head === "users") {
    if (!rest) return { page: "users" };
    if (rest.includes("/")) return { page: "missing" };
    return { page: "user", username: rest };
  }
  if (!rest || rest.includes("/")) return { page: "missing" };
  return { page: "edit", kind: head, id: rest };
}

const previewUrl = "/preview/";

type EditMode = "arrange" | "compose" | "fields" | "raw";

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

/** Unsaved layout. Tab changes read and write this instead of the saved file. */
let layoutSession: ContentSession | undefined;

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
      "styles",
    );
    bindChrome(root);
    return;
  }
  const payload = await getRecord("site", site.id);
  const record =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};
  root.innerHTML = chrome(user, stylesPageHtml(record, notice, error) + (await stylesheetBlock()), true, "styles");
  bindChrome(root);
  bindStylesheetSaves(root, user);
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

async function stylesheetBlock(): Promise<string> {
  try {
    return stylesheetEditors(await listStylesheets());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load stylesheets.";
    return stylesheetEditors([], message);
  }
}

function bindStylesheetSaves(root: HTMLElement, user: PublicUser): void {
  for (const form of root.querySelectorAll<HTMLFormElement>("form[data-sheet]")) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = form.dataset.sheet ?? "";
      const field = form.elements.namedItem("text");
      const text = field instanceof HTMLTextAreaElement ? field.value : "";
      void (async () => {
        try {
          await saveStylesheet(id, text);
          await bindStyles(root, user, "Saved. The preview uses this immediately. Publish to update the published site.");
        } catch (err) {
          await bindStyles(root, user, "", err instanceof Error ? err.message : "Could not save that stylesheet.");
        }
      })();
    });
  }
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
      status.innerHTML = renderNotice(result);
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
  const snapshot = result.snapshot ? ` Snapshot ${escapeHtml(result.snapshot.file)}.` : "";
  return `Rendered ${pages} into the preview.${snapshot} <a href="${previewUrl}">Reload ${previewUrl}</a> to see it.`;
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
  const where = result.installed
    ? ` Installed at ${result.installed}.`
    : " Copy that folder to the live host.";
  if (result.dist.flavour === "pages") {
    const count = result.dist.pages ?? 0;
    return `Published ${count} HTML ${count === 1 ? "file" : "files"} to publish/.${where}`;
  }
  const file = result.dist.snapshot ? ` ${result.dist.snapshot.file}.` : "";
  return `Published the snapshot dist to publish/.${file}${where}`;
}

async function bindAccount(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  root.innerHTML = chrome(user, accountHtml(user, notice, error), false, "account");
  bindChrome(root);
  const usernameForm = root.querySelector<HTMLFormElement>("#username-form");
  usernameForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(usernameForm);
    const next = String(data.get("username") ?? "").trim();
    const problem = usernameError(next);
    if (problem) {
      void bindAccount(root, user, "", problem);
      return;
    }
    if (next === user.username) {
      void bindAccount(root, user, "That is already your username.");
      return;
    }
    const button = usernameForm.querySelector("button");
    if (button) button.disabled = true;
    void (async () => {
      try {
        await changeUsername(next);
        const fresh = await me();
        await bindAccount(root, fresh, `Username is now ${fresh.username}.`);
      } catch (err) {
        await bindAccount(
          root,
          user,
          "",
          err instanceof Error ? err.message : "Could not change the username.",
        );
      }
    })();
  });
  const form = root.querySelector<HTMLFormElement>("#password-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    const problem = passwordChangeError(currentPassword, newPassword, confirmPassword);
    if (problem) {
      void bindAccount(root, user, "", problem);
      return;
    }
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    void (async () => {
      try {
        await changePassword(currentPassword, newPassword, confirmPassword);
        await bindAccount(root, user, "Password changed. Other sessions for this account were signed out.");
      } catch (err) {
        await bindAccount(
          root,
          user,
          "",
          err instanceof Error ? err.message : "Could not change the password.",
        );
      }
    })();
  });
}

function accountHtml(user: PublicUser, notice: string, error: string): string {
  return `<h1 class="w3-large">Account</h1>
    <p class="w3-text-grey">Signed in as <strong>${escapeHtml(user.username)}</strong>.</p>
    ${statusHtml(notice, error)}
    <form id="username-form" class="w3-card w3-white w3-padding-large editor-card">
      <h2 class="w3-medium">Change username</h2>
      <p class="w3-text-grey">Start with a letter. Use letters, numbers, dots, underscores, and hyphens. It has to be different from every other editor.</p>
      <p>
        <label for="account-username">Username</label>
        <input id="account-username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="username" required value="${escapeHtml(user.username)}" />
      </p>
      <p><button type="submit" class="w3-button w3-theme">Change username</button></p>
    </form>
    <form id="password-form" class="w3-card w3-white w3-padding-large editor-card">
      <h2 class="w3-medium">Change password</h2>
      <p class="w3-text-grey">A new site starts with a publicly known password. Replace it with at least 6 characters before anyone else can reach this editor.</p>
      <p>
        <label for="current-password">Current password</label>
        <input id="current-password" name="currentPassword" type="password" class="w3-input w3-border w3-margin-top" autocomplete="current-password" required />
      </p>
      <p>
        <label for="new-password">New password</label>
        <input id="new-password" name="newPassword" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" required />
      </p>
      <p>
        <label for="confirm-password">Confirm new password</label>
        <input id="confirm-password" name="confirmPassword" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" required />
      </p>
      <p><button type="submit" class="w3-button w3-theme">Change password</button></p>
    </form>`;
}

async function bindUsers(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listUsers();
  root.innerHTML = chrome(user, usersHtml(listing.users, user, notice, error), true, "users");
  bindChrome(root);
  const form = root.querySelector<HTMLFormElement>("#new-user-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const problem = usernameError(username) || passwordPairError(password, confirm, true);
    if (problem) {
      void bindUsers(root, user, "", problem);
      return;
    }
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    void (async () => {
      try {
        await createUser(username, password);
        await bindUsers(root, user, `Added ${username}.`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          bindLogin(root, "Sign in again.");
          return;
        }
        await bindUsers(root, user, "", err instanceof Error ? err.message : "Could not add that user.");
      }
    })();
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-user-disable]")) {
    button.addEventListener("click", () => {
      const username = button.dataset.userDisable ?? "";
      if (!username || !window.confirm(`Disable ${username}? They will be signed out and cannot sign in.`)) return;
      void runUserAction(root, user, () => updateUser(username, { disabled: true }), `Disabled ${username}.`);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-user-enable]")) {
    button.addEventListener("click", () => {
      const username = button.dataset.userEnable ?? "";
      if (!username) return;
      void runUserAction(root, user, () => updateUser(username, { disabled: false }), `Enabled ${username}.`);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-user-delete]")) {
    button.addEventListener("click", () => {
      const username = button.dataset.userDelete ?? "";
      if (!username || !window.confirm(`Delete ${username}? This cannot be undone.`)) return;
      void runUserAction(root, user, () => deleteUser(username), `Deleted ${username}.`);
    });
  }
}

async function runUserAction(
  root: HTMLElement,
  user: PublicUser,
  action: () => Promise<unknown>,
  notice: string,
): Promise<void> {
  try {
    await action();
    const fresh = await me();
    await bindUsers(root, fresh, notice);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      bindLogin(root, "Sign in again.");
      return;
    }
    await bindUsers(root, user, "", err instanceof Error ? err.message : "Could not update that user.");
  }
}

async function bindUser(
  root: HTMLElement,
  user: PublicUser,
  username: string,
  notice = "",
  error = "",
): Promise<void> {
  const listing = await listUsers();
  const target = listing.users.find((item) => item.username === username);
  if (!target) {
    root.innerHTML = chrome(
      user,
      `<h1 class="w3-large">User not found</h1><p><a href="#/users">Back to users</a></p>`,
      false,
      "users",
    );
    bindChrome(root);
    return;
  }
  root.innerHTML = chrome(user, userEditHtml(target, user, notice, error), false, "users");
  bindChrome(root);
  const form = root.querySelector<HTMLFormElement>("#edit-user-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const nextName = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const problem = usernameError(nextName) || passwordPairError(password, confirm, false);
    if (problem) {
      void bindUser(root, user, username, "", problem);
      return;
    }
    const self = target.username === user.username;
    const patch: { username: string; password?: string; disabled?: boolean } = { username: nextName };
    if (password) patch.password = password;
    if (!self) patch.disabled = data.get("disabled") === "on";
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    void (async () => {
      try {
        const saved = await updateUser(target.username, patch);
        const fresh = await me();
        const nextHash = `#/users/${encodeURIComponent(saved.user.username)}`;
        if (window.location.hash !== nextHash) history.replaceState(null, "", nextHash);
        await bindUser(root, fresh, saved.user.username, "Saved.");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          bindLogin(root, "Sign in again.");
          return;
        }
        await bindUser(
          root,
          user,
          username,
          "",
          err instanceof Error ? err.message : "Could not save that user.",
        );
      }
    })();
  });
}

function usersHtml(users: ManagedUser[], actor: PublicUser, notice: string, error: string): string {
  const rows = users.length
    ? `<ul class="w3-ul">${users.map((item) => userRow(item, actor)).join("")}</ul>`
    : `<p class="w3-text-grey">No editors yet.</p>`;
  return `<h1 class="w3-large">Users</h1>
    ${statusHtml(notice, error)}
    <p class="w3-text-grey">Every signed-in editor can reach the whole site. A disabled editor is signed out and cannot sign in. You cannot delete or disable the account you are using.</p>
    <form id="new-user-form" class="w3-card w3-white w3-padding-large editor-card">
      <h2 class="w3-medium">Add user</h2>
      <p>
        <label for="new-username">Username</label>
        <input id="new-username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="off" required />
      </p>
      <p>
        <label for="new-user-password">Password</label>
        <input id="new-user-password" name="password" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" required />
      </p>
      <p>
        <label for="new-user-confirm">Confirm password</label>
        <input id="new-user-confirm" name="confirmPassword" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" required />
      </p>
      <p><button type="submit" class="w3-button w3-theme">Add user</button></p>
    </form>
    ${rows}`;
}

function userRow(item: ManagedUser, actor: PublicUser): string {
  const self = item.username === actor.username;
  const name = escapeHtml(item.username);
  const since = escapeHtml(item.createdAt.slice(0, 10));
  const state = item.disabled ? `<span class="w3-text-red">Disabled</span>` : "";
  const you = self ? `<span class="w3-text-grey">Signed in</span>` : "";
  const toggle = self
    ? ""
    : item.disabled
      ? `<button type="button" class="w3-button w3-small w3-white" data-user-enable="${name}">Enable</button>`
      : `<button type="button" class="w3-button w3-small w3-white" data-user-disable="${name}">Disable</button>`;
  const remove = self
    ? ""
    : `<button type="button" class="w3-button w3-small w3-white" data-user-delete="${name}">Delete</button>`;
  return `<li class="editor-user">
      <a href="#/users/${encodeURIComponent(item.username)}">${name}</a>
      <span class="w3-text-grey w3-small">${since}</span>
      ${state}
      ${you}
      <a class="w3-button w3-small w3-white" href="#/users/${encodeURIComponent(item.username)}">Edit</a>
      ${toggle}
      ${remove}
    </li>`;
}

function userEditHtml(target: ManagedUser, actor: PublicUser, notice: string, error: string): string {
  const self = target.username === actor.username;
  const disabled = target.disabled ? " checked" : "";
  const lock = self ? " disabled" : "";
  const note = self
    ? `<p class="w3-text-grey">You cannot disable the account you are signed in with.</p>`
    : "";
  return `<h1 class="w3-large">Edit ${escapeHtml(target.username)}</h1>
    ${statusHtml(notice, error)}
    <form id="edit-user-form" class="w3-card w3-white w3-padding-large editor-card">
      <p>
        <label for="edit-username">Username</label>
        <input id="edit-username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="off" required value="${escapeHtml(target.username)}" />
      </p>
      <p>
        <label for="edit-password">New password</label>
        <input id="edit-password" name="password" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" />
      </p>
      <p>
        <label for="edit-confirm">Confirm new password</label>
        <input id="edit-confirm" name="confirmPassword" type="password" class="w3-input w3-border w3-margin-top" autocomplete="new-password" minlength="6" />
      </p>
      <p class="w3-text-grey">Leave the password blank to keep the current one. A new password must be at least 6 characters.</p>
      <p class="editor-check"><label><input id="user-disabled" name="disabled" type="checkbox"${disabled}${lock} /> Disabled</label></p>
      ${note}
      <p><button type="submit" class="w3-button w3-theme">Save</button></p>
    </form>
    <p><a href="#/users">Back to users</a></p>`;
}

function passwordPairError(password: string, confirm: string, required: boolean): string {
  if (!password && !confirm) return required ? "Password must be at least 6 characters." : "";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password !== confirm) return "Password and confirmation do not match.";
  return "";
}

function passwordChangeError(currentPassword: string, newPassword: string, confirmPassword: string): string {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return "Current password, new password, and confirmation are required.";
  }
  if (newPassword.length < 6) return "Password must be at least 6 characters.";
  if (newPassword !== confirmPassword) return "New password and confirmation do not match.";
  return "";
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

function bindInitSite(
  root: HTMLElement,
  again: (notice: string, error: string) => Promise<void>,
): void {
  root.querySelector("[data-action=init-site]")?.addEventListener("click", () => {
    void (async () => {
      const button = root.querySelector<HTMLButtonElement>("[data-action=init-site]");
      if (button) button.disabled = true;
      try {
        await initSite();
        await again("Started a site with a master layout, a standard page, and a Hello world home page.", "");
      } catch (err) {
        await again("", err instanceof Error ? err.message : "Could not start a site.");
      }
    })();
  });
}

async function bindHome(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listRecords();
  root.innerHTML = chrome(user, homeHtml(listing, notice, error), false, "home");
  bindChrome(root);
  bindInitSite(root, (nextNotice, nextError) => bindHome(root, user, nextNotice, nextError));
}

async function bindList(
  root: HTMLElement,
  user: PublicUser,
  kind?: string,
  notice = "",
  error = "",
): Promise<void> {
  if (kind === "media" || kind === "folders") {
    window.location.hash = "#/library";
    return;
  }
  const listing = await listRecords();
  const active = activeRecordKind(listing, kind);
  const layoutNotes = active === "layouts" ? await loadLayoutListNotes(listing) : new Map<string, string>();
  const bindingInfo = active === "bindings" ? await loadBindingListInfo(listing) : undefined;
  const listNotes = bindingInfo?.notes ?? layoutNotes;
  root.innerHTML = chrome(user, listHtml(listing, kind, notice, error, listNotes), true, "records");
  bindChrome(root);
  bindInitSite(root, (nextNotice, nextError) => bindList(root, user, kind, nextNotice, nextError));
  if (active === "site" || active === "nav") {
    const row = listing.records.find((item) => item.kind === active);
    if (row) await bindEdit(root, user, active, row.id, "fields", "", false, "tab");
  }
  bindEntryFilter(root);
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
  root.querySelector("[data-action=new-layout]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-layout-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-layout-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-layout-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createLayout(root, user, listing);
  });
  root.querySelector("[data-action=new-type]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-type-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-type-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-type-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createType(root, user, listing);
  });
  if (bindingInfo) bindNewBinding(root, listing, bindingInfo.choices);
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
  const existing = listing.records.filter((row) => row.kind === "templates").map((row) => row.id);
  const problem = pageIdError(id, existing);
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const templateId = id.trim();
  try {
    await saveRecord("templates", templateId, newTemplateBody(templateId));
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the template.");
    if (button) button.disabled = false;
    return;
  }
  pendingEdit = { mode: "compose", notice: `Created ${templateId}.` };
  const hash = `#/templates/${encodeURIComponent(templateId)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

async function createLayout(root: HTMLElement, user: PublicUser, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-layout-form");
  if (!form) return;
  const id = form.querySelector<HTMLInputElement>("#new-layout-id")?.value ?? "";
  const existing = listing.records.filter((row) => row.kind === "layouts").map((row) => row.id);
  const problem = pageIdError(id, existing)?.replace("A page with id", "A layout with id");
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const layoutId = id.trim();
  const frame = form.querySelector<HTMLSelectElement>("#new-layout-kind")?.value === "frame";
  try {
    await saveRecord("layouts", layoutId, frame ? newFrame(layoutId) : newPageLayout(layoutId));
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the layout.");
    if (button) button.disabled = false;
    return;
  }
  pendingEdit = { mode: "arrange", notice: `Created ${layoutId}.` };
  const hash = `#/layouts/${encodeURIComponent(layoutId)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

async function createType(root: HTMLElement, user: PublicUser, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-type-form");
  if (!form) return;
  const id = form.querySelector<HTMLInputElement>("#new-type-id")?.value ?? "";
  const existing = listing.records.filter((row) => row.kind === "types").map((row) => row.id);
  const problem = pageIdError(id, existing)?.replace("A page with id", "A type with id");
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const typeId = id.trim();
  try {
    await saveRecord("types", typeId, newTypeBody(typeId));
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the type.");
    if (button) button.disabled = false;
    return;
  }
  pendingEdit = { mode: "fields", notice: `Created ${typeId}.` };
  const hash = `#/types/${encodeURIComponent(typeId)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

function bindNewBinding(root: HTMLElement, listing: RecordList, choices: BindingChoices): void {
  const form = root.querySelector<HTMLFormElement>("#new-binding-form");
  const open = root.querySelector<HTMLButtonElement>("[data-action=new-binding]");
  if (!form || !open) return;
  const existing = listing.records.filter((row) => row.kind === "bindings").map((row) => row.id);
  let state = blankNewBinding();

  const paint = (error = "") => {
    form.hidden = false;
    form.innerHTML = renderNewBinding(state, choices);
    if (error) showNewPageError(form, error);
    form.querySelector<HTMLElement>("[data-binding-focus]")?.focus();
  };

  open.addEventListener("click", () => {
    state = blankNewBinding();
    paint();
  });
  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== "binding-id") return;
    const token = form.querySelector("[data-binding-token]");
    if (token) token.textContent = `{{${target.value.trim() || "id"}}}`;
  });
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.name === "binding-kind") {
      state = readNewBinding(bindingControls(form), folderSelection(form));
      state.step = 1;
      paint();
      return;
    }
    if (target.name === "links-source") syncLinkSource(form);
    if (target.name === "gallery-mode") syncGalleryMode(form);
  });
  form.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!(button instanceof HTMLButtonElement) || button.dataset.bindingStep !== "back") return;
    event.preventDefault();
    state = readNewBinding(bindingControls(form), folderSelection(form));
    state.step = state.step === 3 ? 2 : 1;
    paint();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    state = readNewBinding(bindingControls(form), folderSelection(form));
    if (state.kind === "gallery" && state.step < 3) {
      const problem = state.step === 1 ? bindingIdError(state.id, existing) : undefined;
      if (problem) {
        showNewPageError(form, problem);
        return;
      }
      state = { ...state, step: state.step === 1 ? 2 : 3 };
      paint();
      return;
    }
    void createBinding(root, form, state, existing);
  });
}

async function createBinding(
  root: HTMLElement,
  form: HTMLFormElement,
  state: NewBinding,
  existing: readonly string[],
): Promise<void> {
  const problem = newBindingError(state, existing);
  if (problem) {
    showNewPageError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const id = state.id.trim();
  try {
    await saveRecord("bindings", id, newBindingRecord(state));
  } catch (err) {
    showNewPageError(form, err instanceof Error ? err.message : "Could not create the binding.");
    if (button) button.disabled = false;
    return;
  }
  const notice =
    state.kind === "gallery" ? `Created ${id}. Put it on a page with Compose → Insert.` : `Created ${id}.`;
  pendingEdit = { mode: state.kind === "other" ? "raw" : "fields", notice };
  const hash = `#/bindings/${encodeURIComponent(id)}`;
  if (window.location.hash === hash) await render(root);
  else window.location.hash = hash;
}

function folderSelection(form: HTMLFormElement): string[] | undefined {
  if (!form.querySelector("[data-folder-id]")) return undefined;
  return checkedFolderIds(
    [...form.querySelectorAll<HTMLInputElement>("[data-folder-id]")].map((el) => ({
      id: el.dataset.folderId ?? "",
      checked: el.checked,
    })),
  );
}

function bindingControls(form: HTMLFormElement): { name: string; value: string; checked?: boolean }[] {
  const prefixes = ["binding-", "gallery-", "dated-", "people-", "links-"];
  const controls: { name: string; value: string; checked?: boolean }[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      continue;
    }
    if (!el.name || !prefixes.some((prefix) => el.name.startsWith(prefix))) continue;
    controls.push({
      name: el.name,
      value: el.value,
      checked: el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : undefined,
    });
  }
  return controls;
}

async function loadBindingListInfo(listing: RecordList): Promise<{ notes: Map<string, string>; choices: BindingChoices }> {
  const bindings = listing.records.filter((row) => row.kind === "bindings");
  const content = listing.records.filter((row) => row.kind === "content");
  const types = listing.records.filter((row) => row.kind === "types").map((row) => row.id);
  const empty = { notes: new Map<string, string>(), choices: { folders: [], types, headings: [] } };
  try {
    const [bindingPayloads, contentPayloads, library, nav] = await Promise.all([
      Promise.all(bindings.map((row) => getRecord("bindings", row.id))),
      Promise.all(content.map((row) => getRecord("content", row.id))),
      getLibrary().catch(() => ({ folders: [], assets: [] })),
      getRecord("nav", "nav").catch(() => undefined),
    ]);
    const notes = new Map<string, string>();
    bindings.forEach((row, index) => {
      const used = content.flatMap((page, pageIndex) =>
        bindingIdsIn(contentPayloads[pageIndex]?.data).includes(row.id) ? [{ id: page.id, title: page.title }] : [],
      );
      notes.set(row.id, bindingSentence(bindingPayloads[index]?.data, used));
    });
    return {
      notes,
      choices: { folders: library.folders, types, headings: navHeadings(nav?.data) },
    };
  } catch {
    return empty;
  }
}

async function loadTypeIds(): Promise<string[]> {
  try {
    const listing = await listRecords();
    return listing.records.filter((row) => row.kind === "types").map((row) => row.id);
  } catch {
    return [];
  }
}

async function loadBindingChoices(): Promise<BindingChoices> {
  try {
    const listing = await listRecords();
    const types = listing.records.filter((row) => row.kind === "types").map((row) => row.id);
    const [library, nav] = await Promise.all([
      getLibrary().catch(() => ({ folders: [], assets: [] })),
      getRecord("nav", "nav").catch(() => undefined),
    ]);
    return { folders: library.folders, types, headings: navHeadings(nav?.data) };
  } catch {
    return { folders: [], types: [], headings: [] };
  }
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

function bindTypeEditor(form: HTMLFormElement, id: string, layouts: readonly LayoutChoice[]): void {
  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement) || !form.contains(button)) return;
    const action = button.dataset.typeAction;
    if (!action || !isTypeAction(action)) return;
    const editor = form.querySelector<HTMLElement>("#type-editor");
    if (!editor) return;
    event.preventDefault();
    const draft = applyTypeAction(draftFromControls(typeControls(form), id), action, Number(button.dataset.typeIndex ?? 0));
    editor.innerHTML = renderTypeForm(draft, layouts);
    form.dataset.dirty = "true";
  });
}

function typeBody(id: string, form: HTMLFormElement): Record<string, unknown> {
  const draft = draftFromControls(typeControls(form), id);
  const problem = typeFieldError(draft.fields);
  if (problem) throw new Error(problem);
  return typeRecord(id, draft);
}

async function typeLayoutChoices(current: string): Promise<LayoutChoice[]> {
  try {
    const listing = await listRecords();
    const layouts = listing.records.filter((row) => row.kind === "layouts");
    const payloads = await Promise.all(layouts.map((row) => getRecord("layouts", row.id)));
    const choices: LayoutChoice[] = [];
    layouts.forEach((row, index) => {
      const data = asRecord(payloads[index]?.data);
      const root = asLayoutNode(data?.root);
      if (root && isFrame(root) && row.id !== current) return;
      choices.push({ id: row.id });
    });
    return choices;
  } catch {
    return current ? [{ id: current }] : [];
  }
}

function typeControls(form: HTMLFormElement): ControlValue[] {
  const controls: ControlValue[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      continue;
    }
    if (!el.name.startsWith("type-")) continue;
    controls.push({
      name: el.name,
      value: el.value,
      checked: el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : undefined,
    });
  }
  return controls;
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
  root.innerHTML = chrome(user, backupsHtml(listing, notice, error), true, "backups");
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
  root.querySelector("[data-action=reseed]")?.addEventListener("click", () => {
    if (
      !window.confirm(
        "Replace this site with a fresh Hello world starter? Your editors stay. The current site is saved as a new backup first.",
      )
    ) {
      return;
    }
    void runRestore(root, user, () => reseedSite(), "this site", "Re-seeded");
  });
}

async function runRestore(
  root: HTMLElement,
  user: PublicUser,
  action: () => Promise<{ safetyBackup: string }>,
  label: string,
  verb = "Restored",
): Promise<void> {
  try {
    const result = await action();
    await bindBackups(
      root,
      user,
      `${verb} ${label}. The previous site is ${result.safetyBackup}.`,
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
    <p class="w3-text-grey">Willow is a <code>.tar.gz</code> in that same backup folder. Restoring it fills this site with the community example. Your editors stay.</p>
    ${examples}
    <h2 class="w3-medium">Re-seed</h2>
    <p class="w3-text-grey">Replace this site with a fresh starter: a master layout, a standard type and page layout, a Hello world home page, a header, a left-hand menu, and a common-footer item. The menu stays open on the left from tablet landscape width up. On a narrower screen a Menu button on the right of the bar opens a flyout from the right, so the site title stays put. Editors stay. The current site is saved as a new backup first. Restore Willow when a fuller example is needed.</p>
    <p><button type="button" class="w3-button w3-white" data-action="reseed">Re-seed this site</button></p>`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function homeHtml(listing: RecordList, notice = "", error = ""): string {
  const site = listing.records.find((row) => row.kind === "site");
  const body = site
    ? `<p>This site is <strong>${escapeHtml(site.title ?? site.id)}</strong>.</p>
       <p><a class="w3-button w3-theme" href="${previewUrl}">Open preview</a>
          <a class="w3-button w3-white" href="#/records">Records</a></p>`
    : startSiteHtml();
  return `<h1 class="w3-large">Tessera editor</h1>
    ${statusHtml(notice, error)}
    <p class="w3-text-grey">YAML files named with Tessera <code>id</code>, outside the web root. Saving a page appends the previous file to a history file and refreshes the preview at <code>${previewUrl}</code>. <strong>Render site</strong> rebuilds that preview for every page. <strong>Publish</strong> writes the copyable <code>publish/</code> folder. Set <strong>Publish to</strong> on the site record to also replace the files in an existing directory this process can write. That directory is not created, and files already in it are removed.</p>
    ${body}`;
}

function startSiteHtml(): string {
  return `<p><button type="button" class="w3-button w3-theme" data-action="init-site">Start an empty site</button></p>
    <p class="w3-text-grey">This writes a shell, a master layout, a standard type and page layout, a Hello world home page, and a common-footer item. It does not replace a site that already has records. To replace one, use Re-seed on Backups.</p>`;
}

function statusHtml(notice: string, error: string): string {
  return `${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
    ${error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : ""}`;
}

/** Media and folders are edited in the Library, not as record lists. */
const LIBRARY_RECORD_KINDS = new Set(["media", "folders"]);

/**
 * Left to right: the assembled site, then the layers under it.
 * A layout declares the zones. A type picks one. Items fill those zones, and a
 * binding mounts a component on that fill. A template is a page body copied into
 * content. Navigation is the menu over those pages. Site names the home page and the layouts.
 */
const RECORD_TAB_ORDER = [
  "site",
  "nav",
  "content",
  "templates",
  "bindings",
  "items",
  "types",
  "layouts",
];

function recordTabs(listing: RecordList): { kind: string; label: string }[] {
  const rank = new Map(RECORD_TAB_ORDER.map((kind, index) => [kind, index]));
  return listing.kinds
    .filter((item) => !LIBRARY_RECORD_KINDS.has(item.kind))
    .sort((a, b) => (rank.get(a.kind) ?? RECORD_TAB_ORDER.length) - (rank.get(b.kind) ?? RECORD_TAB_ORDER.length));
}

function activeRecordKind(listing: RecordList, selected?: string): string | undefined {
  const kinds = recordTabs(listing);
  if (selected && kinds.some((item) => item.kind === selected)) return selected;
  if (selected) return undefined;
  return kinds[0]?.kind;
}

function listHtml(
  listing: RecordList,
  selected?: string,
  notice = "",
  error = "",
  layoutNotes: Map<string, string> = new Map(),
): string {
  const byKind = new Map<string, RecordSummary[]>();
  for (const rec of listing.records) {
    const list = byKind.get(rec.kind) ?? [];
    list.push(rec);
    byKind.set(rec.kind, list);
  }
  const kinds = recordTabs(listing);
  const active = activeRecordKind(listing, selected);
  const siteReady = listing.records.some((row) => row.kind === "site");
  const tabs = kinds
    .map((kind) => {
      const on = kind.kind === active;
      return `<a class="w3-button ${on ? "w3-theme" : "w3-white"}" href="#/records/${encodeURIComponent(kind.kind)}"${on ? ' aria-current="page"' : ""}>${escapeHtml(kind.label)}</a>`;
    })
    .join("");
  return `<h1 class="w3-large">Records</h1>
    ${statusHtml(notice, error)}
    ${siteReady ? "" : startSiteHtml()}
    <nav class="editor-tabs" aria-label="Record types">${tabs}</nav>
    ${recordTab(listing, active, byKind, siteReady, layoutNotes)}`;
}

function recordTab(
  listing: RecordList,
  active: string | undefined,
  byKind: Map<string, RecordSummary[]>,
  siteReady: boolean,
  layoutNotes: Map<string, string> = new Map(),
): string {
  const kind = listing.kinds.find((item) => item.kind === active);
  if (!kind) return `<p class="w3-text-grey">That record type is not in this editor.</p>`;
  const rows = byKind.get(kind.kind) ?? [];
  const body =
    kind.kind === "content"
      ? contentSection(rows, byKind.get("templates") ?? [], siteReady)
      : kind.kind === "templates"
        ? templateSection(rows, siteReady)
        : kind.kind === "layouts"
          ? layoutSection(rows, siteReady, layoutNotes)
          : kind.kind === "types"
            ? typeSection(rows, siteReady)
            : kind.kind === "bindings"
              ? bindingSection(rows, siteReady, layoutNotes)
              : kind.kind === "site" || kind.kind === "nav"
          ? singletonEditorMount(kind.kind, rows[0])
          : kindPanel(rows);
  return `<section class="editor-kind" aria-label="${escapeHtml(kind.label)}">${body}</section>`;
}

function singletonEditorMount(kind: string, row: RecordSummary | undefined): string {
  if (!row) {
    const message =
      kind === "site" ? "This site has no site record yet." : "This site has no navigation file yet.";
    return `<p class="w3-text-grey">${message}</p>`;
  }
  return `<div id="record-editor" data-kind="${escapeHtml(kind)}" data-id="${escapeHtml(row.id)}"><p class="w3-text-grey">Loading…</p></div>`;
}

function layoutSection(rows: RecordSummary[], siteReady: boolean, notes: Map<string, string>): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-layout">New layout</button></p>
    <form id="new-layout-form" class="editor-new-page" hidden>
      <p><label for="new-layout-id">Id</label>
        <input id="new-layout-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p class="w3-text-grey">One file, <code>records/layouts/&lt;id&gt;.yaml</code>. Start with a letter or number, then letters, numbers, dots, hyphens, or underscores.</p>
      <p><label for="new-layout-kind">Kind</label>
        <select id="new-layout-kind" name="kind" class="w3-select w3-border w3-margin-top">
          <option value="page">Page layout</option>
          <option value="frame">Frame</option>
        </select>
      </p>
      <p class="w3-text-grey">A page layout declares the zones Compose fills. A frame wraps every page: one page slot, and the menus around it.</p>
      <p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Create layout</button></p>
    </form>
    ${rows.length ? recordList(rows, false, (row) => notes.get(row.id) ?? "Page layout") : `<p class="w3-text-grey">No layouts yet.</p>`}`;
}

async function loadLayoutListNotes(listing: RecordList): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const layouts = listing.records.filter((row) => row.kind === "layouts");
  if (!layouts.length) return notes;
  try {
    const site = listing.records.find((row) => row.kind === "site");
    const types = listing.records.filter((row) => row.kind === "types");
    const [sitePayload, typePayloads, layoutPayloads] = await Promise.all([
      site ? getRecord("site", site.id) : Promise.resolve(undefined),
      Promise.all(types.map((row) => getRecord("types", row.id))),
      Promise.all(layouts.map((row) => getRecord("layouts", row.id))),
    ]);
    const siteData = sitePayload ? asRecord(sitePayload.data) : undefined;
    const masterId = siteData?.masterLayoutId ? String(siteData.masterLayoutId) : undefined;
    const defaultId = siteData?.defaultLayoutId ? String(siteData.defaultLayoutId) : undefined;
    const typesByLayout = new Map<string, string[]>();
    for (const item of typePayloads) {
      const data = asRecord(item.data);
      if (!data?.layoutId || !data.id) continue;
      const layoutId = String(data.layoutId);
      const list = typesByLayout.get(layoutId) ?? [];
      list.push(String(data.id));
      typesByLayout.set(layoutId, list);
    }
    const frames = new Set<string>();
    layouts.forEach((row, index) => {
      const data = asRecord(layoutPayloads[index]?.data);
      const root = asLayoutNode(data?.root);
      if (root && isFrame(root)) frames.add(row.id);
    });
    for (const row of layouts) {
      notes.set(row.id, layoutListNote(row.id, frames.has(row.id), masterId, defaultId, typesByLayout.get(row.id) ?? []));
    }
  } catch {
    return notes;
  }
  return notes;
}

function layoutListNote(
  id: string,
  frame: boolean,
  masterId: string | undefined,
  defaultId: string | undefined,
  typeIds: string[],
): string {
  if (masterId === id) return "Frame, used on every page";
  if (frame) return "Frame";
  const bits = [...typeIds];
  if (defaultId === id) bits.push("site default");
  return bits.length ? `Page layout, ${bits.join(", ")}` : "Page layout";
}

function kindPanel(rows: RecordSummary[]): string {
  return rows.length ? recordList(rows) : `<p class="w3-text-grey">No records yet.</p>`;
}

function contentSection(rows: RecordSummary[], templates: RecordSummary[], siteReady: boolean): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  const options = templates
    .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.title ?? row.id)}</option>`)
    .join("");
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-page">New page</button></p>
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
    ${rows.length ? `${entryFilter()}${recordList(rows, true)}<p id="entry-filter-empty" class="w3-text-grey" hidden>No entries match.</p>` : `<p class="w3-text-grey">No records yet.</p>`}`;
}

function entryFilter(): string {
  return `<div class="editor-entry-filter" id="entry-filter">
    <p><label for="filter-type">Type</label>
      <input id="filter-type" name="type" class="w3-input w3-border w3-margin-top" autocomplete="off" />
    </p>
    <p><label for="filter-tag">Tag</label>
      <input id="filter-tag" name="tag" class="w3-input w3-border w3-margin-top" autocomplete="off" />
    </p>
    <p><label for="filter-title">Title</label>
      <input id="filter-title" name="title" class="w3-input w3-border w3-margin-top" autocomplete="off" />
    </p>
    <p><button type="button" class="w3-button w3-white" data-action="clear-entry-filter">Clear</button></p>
  </div>`;
}

function bindEntryFilter(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>("#entry-filter");
  const list = root.querySelector<HTMLUListElement>("#entry-list");
  const empty = root.querySelector<HTMLElement>("#entry-filter-empty");
  if (!bar || !list) return;
  const apply = () => {
    const query = {
      type: bar.querySelector<HTMLInputElement>("[name=type]")?.value ?? "",
      tag: bar.querySelector<HTMLInputElement>("[name=tag]")?.value ?? "",
      title: bar.querySelector<HTMLInputElement>("[name=title]")?.value ?? "",
    };
    let shown = 0;
    for (const item of list.querySelectorAll<HTMLLIElement>("li")) {
      const visible = entryVisible(
        {
          type: item.dataset.type,
          tags: (item.dataset.tags ?? "").split("\u001f").filter(Boolean),
          title: item.dataset.title,
        },
        query,
      );
      item.hidden = !visible;
      if (visible) shown += 1;
    }
    if (empty) empty.hidden = shown !== 0;
  };
  bar.addEventListener("input", apply);
  bar.querySelector("[data-action=clear-entry-filter]")?.addEventListener("click", () => {
    for (const input of bar.querySelectorAll("input")) input.value = "";
    apply();
  });
}

function typeSection(rows: RecordSummary[], siteReady: boolean): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-type">New type</button></p>
    <form id="new-type-form" class="editor-new-page" hidden>
      <p><label for="new-type-id">Id</label>
        <input id="new-type-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p class="w3-text-grey">One file, <code>records/types/&lt;id&gt;.yaml</code>. Start with a letter or number, then letters, numbers, dots, hyphens, or underscores. The id is the name a page’s Type field uses.</p>
      <p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Create type</button></p>
    </form>
    ${rows.length ? recordList(rows) : `<p class="w3-text-grey">No types yet.</p>`}`;
}

function bindingSection(rows: RecordSummary[], siteReady: boolean, notes: Map<string, string>): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-binding">New binding</button></p>
    <form id="new-binding-form" class="editor-new-page" hidden></form>
    <p class="w3-text-grey">A binding is a named piece you drop on a page with Compose → Insert. <a href="#/guide">Guide</a>.</p>
    ${rows.length ? recordList(rows, false, (row) => notes.get(row.id) ?? "") : `<p class="w3-text-grey">No bindings yet.</p>`}`;
}

function templateSection(rows: RecordSummary[], siteReady: boolean): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-template">New template</button></p>
    <form id="new-template-form" class="editor-new-page" hidden>
      <p><label for="new-template-id">Id</label>
        <input id="new-template-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p class="w3-text-grey">One file, <code>records/templates/&lt;id&gt;.yaml</code>. Copy that file to reuse the template on another site. Start with a letter or number, then letters, numbers, dots, hyphens, or underscores.</p>
      <p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Create template</button></p>
    </form>
    ${rows.length ? recordList(rows) : `<p class="w3-text-grey">No records yet.</p>`}`;
}

function editsBody(kind: string | undefined): boolean {
  return kind === "content" || kind === "templates";
}

function initialEditMode(kind: string, pending: { mode: EditMode } | undefined): EditMode {
  const mode = pending?.mode;
  if (editsBody(kind)) {
    if (mode === "compose" || mode === "fields" || mode === "raw") return mode;
    return "compose";
  }
  if (kind === "layouts") {
    if (mode === "arrange" || mode === "fields" || mode === "raw") return mode;
    return "arrange";
  }
  if (kind === "bindings" && (mode === "fields" || mode === "raw")) return mode;
  return "fields";
}

async function loadArrangeInfo(layoutId: string): Promise<ArrangeInfo> {
  try {
    const listing = await listRecords();
    const site = listing.records.find((row) => row.kind === "site");
    const types = listing.records.filter((row) => row.kind === "types");
    const [sitePayload, typePayloads] = await Promise.all([
      site ? getRecord("site", site.id) : Promise.resolve(undefined),
      Promise.all(types.map((row) => getRecord("types", row.id))),
    ]);
    const siteData = sitePayload ? asRecord(sitePayload.data) : undefined;
    const typeIds = typePayloads
      .map((item) => asRecord(item.data))
      .filter((data): data is Record<string, unknown> => !!data && data.layoutId === layoutId)
      .map((data) => String(data.id));
    return {
      layoutId,
      master: siteData?.masterLayoutId === layoutId,
      fallback: siteData?.defaultLayoutId === layoutId,
      typeIds,
    };
  } catch {
    return { layoutId, master: false, fallback: false, typeIds: [] };
  }
}

function readLayoutDraft(
  form: HTMLFormElement,
  mode: EditMode,
  current: Record<string, unknown>,
  baselineRaw: string,
  baselineData: unknown,
):
  | { ok: true; unchanged: true }
  | { ok: true; unchanged: false; draft: Record<string, unknown>; fromEditor: boolean }
  | { ok: false; error: string } {
  if (mode === "raw") {
    const text = form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "";
    if (text === baselineRaw) return { ok: true, unchanged: true };
    try {
      const parsed = parseYaml(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "This layout file must be a YAML mapping." };
      }
      return { ok: true, unchanged: false, draft: parsed as Record<string, unknown>, fromEditor: false };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not read this YAML." };
    }
  }
  let draft = current;
  if (mode === "arrange") {
    const root = readArrangeRoot(form);
    if (!root) return { ok: false, error: "Could not read this layout." };
    draft = { ...current, root };
  } else {
    const read = readFormValues(form, schemaFor("layouts", current), current);
    if (!read || typeof read !== "object" || Array.isArray(read)) return { ok: false, error: "Could not read this layout." };
    draft = read as Record<string, unknown>;
  }
  if (!layoutDraftChanged(draft, baselineData)) return { ok: true, unchanged: true };
  return { ok: true, unchanged: false, draft, fromEditor: true };
}

function layoutDraftChanged(draft: Record<string, unknown>, baselineData: unknown): boolean {
  if (!baselineData || typeof baselineData !== "object" || Array.isArray(baselineData)) return true;
  const baseline = baselineData as Record<string, unknown>;
  const nextRoot = asLayoutNode(draft.root);
  const baseRoot = asLayoutNode(baseline.root);
  if (!nextRoot || !baseRoot) return JSON.stringify(draft) !== JSON.stringify(baseline);
  const { root: _next, ...rest } = draft;
  const { root: _base, ...baseRest } = baseline;
  return JSON.stringify(cleanNode(nextRoot)) !== JSON.stringify(cleanNode(baseRoot)) || JSON.stringify(rest) !== JSON.stringify(baseRest);
}

function recordList(rows: RecordSummary[], entries = false, noteFor?: (row: RecordSummary) => string): string {
  return `<ul class="w3-ul"${entries ? ' id="entry-list"' : ""}>
    ${rows
      .map((row) => {
        const publicTitle = row.kind === "site" || row.kind === "content" || row.kind === "nav";
        const label = publicTitle ? (row.title ?? row.id) : row.id;
        const idNote =
          publicTitle && row.title && row.title !== row.id
            ? ` <span class="w3-text-grey w3-small">${escapeHtml(row.id)}</span>`
            : "";
        const typeNote = row.type ? ` <span class="w3-text-grey w3-small">${escapeHtml(row.type)}</span>` : "";
        const extra = noteFor?.(row);
        const extraNote = extra ? ` <span class="w3-text-grey w3-small">${escapeHtml(extra)}</span>` : "";
        const attrs = entries
          ? ` data-type="${escapeHtml(row.type ?? "")}" data-tags="${escapeHtml((row.tags ?? []).join("\u001f"))}" data-title="${escapeHtml(row.title ?? row.id)}"`
          : "";
        return `<li${attrs}><a href="#/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}">${escapeHtml(label)}</a>${idNote}${typeNote}${extraNote}</li>`;
      })
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
  host: "page" | "tab" = "page",
): Promise<void> {
  const key = `${kind}/${id}`;
  let payload: RecordPayload;
  if (editsBody(kind) && keepDraft && contentSession?.key === key) {
    payload = contentSession.payload;
  } else if (kind === "layouts" && keepDraft && layoutSession?.key === key) {
    payload = layoutSession.payload;
  } else {
    payload = await getRecord(kind, id);
    const loaded = asRecord(payload.data);
    if (editsBody(kind) && loaded) {
      contentSession = { key, payload, draft: structuredClone(loaded), fromEditor: false };
    } else if (editsBody(kind)) {
      contentSession = undefined;
    }
    if (kind === "layouts" && loaded) {
      layoutSession = { key, payload, draft: structuredClone(loaded), fromEditor: false };
    } else if (kind === "layouts") {
      layoutSession = undefined;
    }
  }
  const session = editsBody(kind) ? contentSession : kind === "layouts" ? layoutSession : undefined;
  const record = session?.draft ?? asRecord(payload.data);
  const rawShown = session ? rawText(session.fromEditor, session.draft, payload.raw) : payload.raw;
  const editMode: EditMode =
    mode === "compose" && !editsBody(kind) ? "fields" : mode === "arrange" && kind !== "layouts" ? "fields" : mode;
  const bodyLayout = kind === "templates" ? templateBodyLayout() : payload.layout;
  const navList = kind === "nav" && editMode === "fields" && Array.isArray(payload.data);
  const pages: PageChoice[] = navList ? await contentPages() : [];
  const navNote =
    kind === "nav" && editMode === "fields" && !Array.isArray(payload.data)
      ? `<p class="w3-text-grey">This navigation file is not a list. Edit it as YAML, or switch to Raw file.</p>`
      : "";
  const assisted = kind === "bindings" && editMode === "fields" && bindingKind(record) !== "other";
  const bindingChoices = assisted ? await loadBindingChoices() : undefined;
  const arrangeInfo = kind === "layouts" ? await loadArrangeInfo(id) : undefined;
  const layoutRoot = kind === "layouts" ? asLayoutNode(record?.root) : undefined;
  const typeEditor = kind === "types" && editMode === "fields" && !!record;
  const typeLayouts = typeEditor ? await typeLayoutChoices(typeof record.layoutId === "string" ? record.layoutId : "") : [];
  const typeIds =
    editsBody(kind) && (editMode === "compose" || editMode === "fields") ? await loadTypeIds() : undefined;
  const formInner =
    editMode === "arrange"
      ? layoutRoot && arrangeInfo
        ? arrangeMarkup(layoutRoot, arrangeInfo)
        : `<p class="w3-panel w3-pale-red" role="alert">This layout’s root could not be read. Use Raw file.</p>`
      : editMode === "raw"
      ? `<p><label for="raw-file">Raw YAML</label>
         <textarea id="raw-file" name="raw" rows="24" spellcheck="false" class="w3-input w3-border w3-margin-top editor-raw">${escapeHtml(rawShown)}</textarea></p>
         <p class="w3-text-grey">Indent with spaces. Two spaces per level is what Fields → Save writes. Keys at one level share a column. <a href="#/guide">Guide</a>.</p>`
      : editMode === "compose" && record
        ? composeFormInner(kind, record, bodyLayout, typeIds)
      : navList
        ? `<p class="w3-text-grey">Sidebar, Top bar, and Footer choose which menu component can show the row. A heading’s Type lists every page of that type. <strong>Show in nav</strong> on a page does not add a link. <a href="#/guide">Guide</a>.</p>
           <div id="nav-editor">${renderNavList(navRows(payload.data), pages)}</div>`
        : typeEditor
          ? `<div id="type-editor">${renderTypeForm(typeDraft(record), typeLayouts)}</div>`
          : assisted && record && bindingChoices
            ? renderBindingForm(id, record, bindingChoices)
            : `${navNote}${fieldsHtml(kind, record ?? payload.data, payload.layout, typeIds)}`;
  const editor = `${lifecycleHtml(payload)}
     ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
     <p class="editor-tabs">
       ${
         kind === "layouts"
           ? `<button type="button" class="w3-button ${editMode === "arrange" ? "w3-theme" : "w3-white"}" data-mode="arrange">Arrange</button>`
           : ""
       }
       ${
         editsBody(kind)
           ? `<button type="button" class="w3-button ${editMode === "compose" ? "w3-theme" : "w3-white"}" data-mode="compose">Compose</button>`
           : ""
       }
       <button type="button" class="w3-button ${editMode === "fields" ? "w3-theme" : "w3-white"}" data-mode="fields">Fields</button>
       <button type="button" class="w3-button ${editMode === "raw" ? "w3-theme" : "w3-white"}" data-mode="raw">Raw file</button>
     </p>
     <p class="w3-text-grey editor-record-note"><code>${escapeHtml(payload.file)}</code></p>
     <form id="record-form" class="w3-card w3-white w3-padding-large editor-card">
       ${formInner}
       <p id="save-status" class="w3-text-grey" hidden></p>
       <p class="editor-actions"><button type="submit" class="w3-button w3-theme">Save</button>${
         editsBody(kind) || kind === "layouts"
           ? `<button type="button" class="w3-button w3-white" data-action="revert">Revert</button>`
           : ""
       }</p>
     </form>
     ${historyHtml(payload)}`;
  let scope: ParentNode = root;
  if (host === "tab") {
    const slot = root.querySelector<HTMLElement>("#record-editor");
    if (!slot?.isConnected || slot.dataset.kind !== kind || slot.dataset.id !== id) return;
    slot.innerHTML = editor;
    scope = slot;
  } else {
    root.innerHTML = chrome(
      user,
      `<p><a href="#/records/${encodeURIComponent(kind)}">← Records</a></p>
       <h1 class="w3-large">${escapeHtml(kind)} / ${escapeHtml(id)}</h1>
       ${editor}`,
      true,
      "records",
    );
    bindChrome(root);
  }
  if (editMode === "compose" || editMode === "arrange") root.querySelector(".editor-main")?.classList.add("editor-compose");
  const form = scope.querySelector<HTMLFormElement>("#record-form");
  if (form && editMode === "compose" && record) await mountPageCanvas(form, record, bodyLayout);
  if (form && editMode === "arrange" && layoutRoot && arrangeInfo) mountArrange(form, layoutRoot, arrangeInfo);
  for (const button of scope.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode;
      if (next !== "arrange" && next !== "compose" && next !== "fields" && next !== "raw") return;
      if (next === editMode) return;
      if (editsBody(kind) && contentSession && form && (editMode === "compose" || editMode === "fields" || editMode === "raw")) {
        const taken = readContentDraft(form, editMode, contentSession.draft, contentSession.payload.raw, contentSession.payload.data, kind);
        if (!taken.ok) {
          showSaveError(root, taken.error);
          return;
        }
        if (!taken.unchanged) {
          contentSession.draft = taken.draft;
          contentSession.fromEditor = taken.fromEditor;
        }
        void bindEdit(root, user, kind, id, next, "", true, host);
        return;
      }
      if (kind === "layouts" && layoutSession && form && (editMode === "arrange" || editMode === "fields" || editMode === "raw")) {
        const taken = readLayoutDraft(form, editMode, layoutSession.draft, layoutSession.payload.raw, layoutSession.payload.data);
        if (!taken.ok) {
          showSaveError(root, taken.error);
          return;
        }
        if (!taken.unchanged) {
          layoutSession.draft = taken.draft;
          layoutSession.fromEditor = taken.fromEditor;
        }
        void bindEdit(root, user, kind, id, next, "", true, host);
        return;
      }
      void bindEdit(root, user, kind, id, next === "compose" || next === "arrange" ? "fields" : next, "", false, host);
    });
  }
  for (const button of scope.querySelectorAll<HTMLButtonElement>("[data-history]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.history);
      void showHistory(root, kind, id, index);
    });
  }
  if (form && navList) bindNavEditor(form, pages);
  if (form && typeEditor) bindTypeEditor(form, id, typeLayouts);
  if (form && assisted) bindBindingForm(form);
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
    layoutSession = undefined;
    void bindEdit(root, user, kind, id, editMode, "", false, host);
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button) (button as HTMLButtonElement).disabled = true;
    try {
      let saved;
      if (kind === "layouts" && layoutSession && form && (editMode === "arrange" || editMode === "fields" || editMode === "raw")) {
        const taken = readLayoutDraft(form, editMode, layoutSession.draft, layoutSession.payload.raw, layoutSession.payload.data);
        if (!taken.ok) {
          showSaveError(root, taken.error);
          if (button) (button as HTMLButtonElement).disabled = false;
          return;
        }
        if (!taken.unchanged) {
          layoutSession.draft = taken.draft;
          layoutSession.fromEditor = taken.fromEditor;
        }
        saved =
          editMode === "raw"
            ? await saveRawRecord(kind, id, form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "")
            : await saveRecord(kind, id, layoutSession.draft);
      } else if (editsBody(kind) && contentSession && (editMode === "compose" || editMode === "fields" || editMode === "raw")) {
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
                  : kind === "types" && editMode === "fields"
                    ? typeBody(id, form)
                    : kind === "bindings" && editMode === "fields"
                      ? bindingBody(id, form, payload.data)
                      : saveRecordBody(kind, form, payload.data),
              );
      }
      await bindEdit(root, user, kind, id, editMode, saveNotice(saved), false, host);
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
      .map((row) => ({ id: row.id }));
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
  return `<p class="w3-text-grey editor-record-note" id="lifecycle">Authoring schema ${payload.schemaVersion}.${published}</p>`;
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
  types?: readonly string[],
): string {
  if (Array.isArray(data) || !data || typeof data !== "object") {
    return renderForm(
      { fields: [{ name: "_yaml", label: Array.isArray(data) ? "Entries" : "Data", type: "yaml", rows: Array.isArray(data) ? 16 : 12 }] },
      { _yaml: data },
    );
  }
  const record = data as Record<string, unknown>;
  if (kind === "bindings") return bindingFields(record);
  const schema = recordSchema(kind, record, layout, types);
  if (!schema) {
    return renderForm({ fields: [{ name: "_yaml", label: "Data", type: "yaml", rows: 12 }] }, { _yaml: data });
  }
  const authoredNames = new Set((authoredSchema(kind)?.fields ?? schema.fields).map((field) => field.name));
  const base = schema.fields.filter((field) => authoredNames.has(field.name));
  const extras = schema.fields.filter((field) => !authoredNames.has(field.name));
  const zones =
    kind === "content"
      ? `${layoutBanner(layout)}${frameNote(layout)}${typeFieldInputs(record, layout)}${zoneFields(zonesOf(record), layout)}`
      : "";
  const navHint =
    kind === "content"
      ? `<p class="w3-text-grey"><strong>Show in nav</strong> stores a flag on this page. Links are chosen on <a href="#/records/nav">Nav</a>, then drawn by a component in the master layout. <a href="#/guide">Guide</a>.</p>`
      : "";
  return `${renderForm({ fields: base }, record)}${navHint}${zones}${extras.length ? renderForm({ fields: extras }, record) : ""}`;
}

function recordSchema(
  kind: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
  types?: readonly string[],
) {
  let schema = schemaFor(kind, record);
  if (schema && (kind === "content" || kind === "templates") && types) {
    schema = withTypeChoices(schema, types, typeof record.type === "string" ? record.type : undefined);
  }
  if (schema && kind === "content" && layout?.frames) {
    schema = withFrameChoices(
      schema,
      layout.frames,
      typeof record.masterLayoutId === "string" ? record.masterLayoutId : undefined,
    );
  }
  return schema;
}

function zonesOf(record: Record<string, unknown>): Record<string, unknown> {
  return record.zones && typeof record.zones === "object" && !Array.isArray(record.zones)
    ? (record.zones as Record<string, unknown>)
    : {};
}

function layoutBanner(layout?: PageLayoutHint): string {
  if (!layout) return "";
  const via = layout.layoutSource === "type" ? `type ${layout.typeId ?? ""}`.trim() : "site default";
  return `<p class="w3-text-grey">Zones from layout <strong>${escapeHtml(layout.layoutId)}</strong> (${escapeHtml(via)}).</p>`;
}

function typeFieldInputs(record: Record<string, unknown>, layout?: PageLayoutHint): string {
  const stored =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : {};
  const declared = layout?.fields ?? [];
  const ids = declared.length
    ? declared.map((field) => field.id)
    : Object.keys(stored);
  if (!ids.length) return "";
  const inputs = ids.map((id) => textField(`fields.${id}`, labelize(id), typeof stored[id] === "string" ? stored[id] : ""));
  return `<fieldset class="editor-fieldset"><legend>Fields</legend><div class="editor-props">${inputs.join("")}</div></fieldset>`;
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
      return `<fieldset class="editor-fieldset${offLayout ? " editor-off-layout-fields" : ""}"><legend>${escapeHtml(legend)}</legend><div class="editor-props">${entries
        .map(([k, v]) => {
          const library =
            typeof v === "string" || v === undefined
              ? `<button type="button" class="w3-button w3-small w3-white" data-insert="id" data-target="${escapeHtml(`zones.${name}.json.${k}`)}">Library</button>`
              : "";
          return textField(`zones.${name}.json.${k}`, labelize(k), String(v ?? ""), "text", library);
        })
        .join("")}</div></fieldset>`;
    }
  }
  return yamlField(`zones.${name}.json`, legend, json, 8);
}

function textField(name: string, label: string, value: string, type = "text", after = ""): string {
  const id = `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" data-kind="${type}" class="w3-input w3-border" value="${escapeHtml(value)}" />${after}</p>`;
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
    <textarea id="${id}" name="${escapeHtml(name)}" data-kind="yaml" rows="${rows}" spellcheck="false" class="w3-input w3-border w3-margin-top editor-yaml">${escapeHtml(text)}</textarea></p>`;
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
  const fields = record.fields;
  let prunedFields: Record<string, unknown> | undefined;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    const kept: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim() === "") continue;
      kept[id] = value;
    }
    if (Object.keys(kept).length) prunedFields = kept;
  }
  const withZones = { ...record, zones: next };
  if (prunedFields) return { ...withZones, fields: prunedFields };
  if ("fields" in withZones) {
    const { fields: _fields, ...rest } = withZones;
    return rest;
  }
  return withZones;
}

function bindingFields(record: Record<string, unknown>): string {
  const schema = schemaFor("bindings", record);
  return schema ? renderForm(schema, record) : "";
}

function bindingBody(id: string, form: HTMLFormElement, original: unknown): unknown {
  const kind = bindingKind(original);
  const controls = bindingControls(form);
  if (kind === "gallery") return galleryRecord(id, galleryDraftFromForm(controls, folderSelection(form) ?? []));
  if (kind === "dated") {
    const draft = datedDraftFromForm(controls);
    const problem = limitError(draft.limit);
    if (problem) throw new Error(problem);
    return datedRecord(id, draft);
  }
  if (kind === "people") {
    const draft = peopleDraftFromForm(controls);
    const problem = limitError(draft.limit);
    if (problem) throw new Error(problem);
    return peopleRecord(id, draft);
  }
  if (kind === "links") {
    const draft = linksDraftFromForm(controls);
    if (draft.source === "type" && !draft.type.trim()) throw new Error("Choose a type.");
    if (draft.source === "nav" && !draft.heading.trim()) throw new Error("Enter a menu heading.");
    return linksRecord(id, draft);
  }
  return saveRecordBody("bindings", form, original);
}

function bindBindingForm(form: HTMLFormElement): void {
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.name === "gallery-mode") syncGalleryMode(form);
    if (target.name === "links-source") syncLinkSource(form);
  });
}

function syncGalleryMode(form: HTMLFormElement): void {
  const mode = form.querySelector<HTMLSelectElement>("[name=gallery-mode]")?.value;
  const autoplay = form.querySelector<HTMLElement>("[data-gallery-autoplay]");
  if (autoplay) autoplay.hidden = mode !== "slides";
}

function syncLinkSource(form: HTMLFormElement): void {
  const source = form.querySelector<HTMLSelectElement>("[name=links-source]")?.value;
  const type = form.querySelector<HTMLElement>("[data-links-type]");
  const heading = form.querySelector<HTMLElement>("[data-links-heading]");
  if (type) type.hidden = source !== "type";
  if (heading) heading.hidden = source !== "nav";
}

function saveRecordBody(kind: string, form: HTMLFormElement, original: unknown): unknown {
  return pruneEmptyHtmlZones(readFormValues(form, schemaFor(kind, original), original));
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

let libraryAddOpen = true;

async function bindLibrary(root: HTMLElement, user: PublicUser, openId: string | null, notice = ""): Promise<void> {
  const listing = await getLibrary();
  root.innerHTML = chrome(user, renderLibrary(listing, openId, notice, libraryAddOpen), true, "library");
  bindChrome(root);
  const addPanel = root.querySelector<HTMLDetailsElement>("#library-add");
  addPanel?.addEventListener("toggle", () => {
    libraryAddOpen = addPanel.open;
  });
  const form = root.querySelector<HTMLFormElement>("#library-upload");
  let incoming: Promise<{ file: File; path: string }[]> = Promise.resolve([]);
  form?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  form?.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const read = readDataTransfer(event.dataTransfer);
    incoming = read;
    void read.then((files) => {
      if (incoming !== read) return;
      const status = form.querySelector<HTMLElement>("#library-upload-status");
      if (status) {
        status.hidden = false;
        status.textContent = `${files.length} file${files.length === 1 ? "" : "s"} ready.`;
      }
    });
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = incoming;
    incoming = Promise.resolve([]);
    void read.then((files) => submitLibraryUpload(root, user, form, openId, files));
  });
  root.querySelector("[data-action=new-folder]")?.addEventListener("click", () => {
    const id = window.prompt("Folder id");
    if (!id?.trim()) return;
    void createLibraryFolder(id.trim(), openId ?? undefined)
      .then(() => bindLibrary(root, user, openId, `Created ${id.trim()}.`))
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
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-edit-asset]")) {
    button.addEventListener("click", () => {
      const asset = listing.assets.find((item) => item.id === button.dataset.editAsset);
      if (!asset) return;
      const slot = root.querySelector<HTMLElement>("#library-detail");
      if (!slot) return;
      root.querySelectorAll(".editor-library-row-active").forEach((row) => row.classList.remove("editor-library-row-active"));
      button.closest(".editor-library-row")?.classList.add("editor-library-row-active");
      slot.innerHTML = assetDetail(asset, listing.folders);
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
      slot.querySelector<HTMLButtonElement>("[data-delete-asset]")?.addEventListener("click", () => {
        if (!window.confirm("Delete this file?")) return;
        void deleteLibraryAsset(asset.id).then(() => bindLibrary(root, user, openId, "File deleted."));
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
        status.textContent = "Give the new folder an id.";
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

