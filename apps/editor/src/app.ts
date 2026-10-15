import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  ApiError,
  cascadeBlog,
  createBackup,
  deleteBackup,
  deleteContent,
  deleteItem,
  deleteBlog,
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
  renameItem,
  renameContent,
  renameBlog,
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
  rescanLibrary,
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
import { draftYaml, dropArticleTitleZone, parsePageYaml } from "./compose/draft.js";
import { readContentDocument, readContentDraft, composeFormInner, frameNote, htmlByZone, rawText, templateBodyLayout, type ContentMode } from "./compose/view.js";
import { announceRoute, editorChrome as chrome, loginView } from "./chrome.js";
import { editPlace } from "./edit-place.js";
import { createRecord, type CreateRecordDestination } from "./create-record.js";
import { activateDialog, type DialogController } from "./dialog.js";
import { readFormValues, renderForm } from "./forms/form.js";
import { canRedo, canUndo, clearBurst, noteChange, redo, undo, undoHistory, type UndoHistory } from "./undo.js";
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
import { articleMeta, blogMeta, heroField, indexNote } from "./forms/article.js";
import { formatJsonText, itemContent, itemZoneError, jsonText, newItemBody, tidyItemRecord, zonesDeclaredBy } from "./forms/item.js";
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
  pickerUpload,
  renderPicker,
  type PickerMode,
  type PickedAsset,
} from "./forms/picker.js";
import { editorMediaSrc } from "./forms/media-url.js";
import { guideHtml } from "./guide.js";
import { escapeHtml, fieldId, formErrorPanel, noticePanel, statusPanels } from "./dom.js";
import { buildContentCreationRank } from "./creation-rank.js";
import {
  readArticleListOrder,
  sortArticles,
  writeArticleListOrder,
  type ArticleListOrder,
} from "./articles-list.js";
import {
  buildNavSortDocument,
  readPageListOrder,
  sortPages,
  writePageListOrder,
  type ListedPage,
  type PageListOrder,
} from "./pages-list.js";
import type { NavEntry } from "@r-a-i-t-h/tessera-model";
import { parseRoute } from "./router.js";
import { paintSpecimen, previewStyle, readStyleForm, stylesheetEditors, stylesPageHtml } from "./styles-page.js";
import { usernameError } from "./username.js";
import { handleEscape, hasOpenModal } from "./escape-key.js";

let libraryAddOpen = true;

export async function mount(root: HTMLElement): Promise<void> {
  window.addEventListener("hashchange", () => void render(root));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !hasOpenModal() &&
      handleEscape(root, { onLibraryAddClose: () => { libraryAddOpen = false; } })
    ) {
      event.preventDefault();
      return;
    }
    if (event.code !== "KeyS" || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
    const active = document.activeElement;
    const focused = active instanceof HTMLElement ? active.closest("form") : null;
    const form = editingForm(focused) ?? document.querySelector<HTMLFormElement>("#record-form");
    if (!form) return;
    event.preventDefault();
    form.requestSubmit();
  });
  await render(root);
}

function editingForm(form: HTMLFormElement | null): HTMLFormElement | null {
  if (!form) return null;
  if (form.id === "record-form" || form.id === "style-form" || form.id === "asset-detail" || form.hasAttribute("data-sheet")) {
    return form;
  }
  return null;
}

let lastAnnouncedHash = "";

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

  const route = parseRoute(window.location.hash);
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
    else if (route.page === "pages") await bindPages(root, user);
    else if (route.page === "articles") await bindArticles(root, user, route.blog);
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
    const routeHash = window.location.hash || "#/";
    if (routeHash !== lastAnnouncedHash) {
      announceRoute(root);
      lastAnnouncedHash = routeHash;
    }
  } catch (err) {
    root.innerHTML = chrome(
      user,
      `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(err instanceof Error ? err.message : "Error")}</p>
       <p><a href="#/">Back to the editor</a></p>`,
    );
    bindChrome(root);
  }
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
  undo: UndoHistory;
};

/** Unsaved content page. Tab changes read and write this instead of the saved file. */
let contentSession: ContentSession | undefined;

/** Unsaved layout. Tab changes read and write this instead of the saved file. */
let layoutSession: ContentSession | undefined;

/** True while undo or redo is redrawing the open record. */
let historyRestore = false;

let undoKeys: AbortController | undefined;

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
  if (!window.confirm("Publish this site? This replaces the published files.")) return;
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
    ${statusPanels(notice, error)}
    <form id="username-form" class="w3-card w3-white w3-padding-large editor-card">
      <h2 class="w3-medium">Change username</h2>
      <p>
        <label for="account-username">Username</label>
        <input id="account-username" name="username" class="w3-input w3-border w3-margin-top" autocomplete="username" required value="${escapeHtml(user.username)}" />
      </p>
      <p><button type="submit" class="w3-button w3-theme">Change username</button></p>
    </form>
    <form id="password-form" class="w3-card w3-white w3-padding-large editor-card">
      <h2 class="w3-medium">Change password</h2>
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
    ${statusPanels(notice, error)}
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
  const note = "";
  return `<h1 class="w3-large">Edit ${escapeHtml(target.username)}</h1>
    ${statusPanels(notice, error)}
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
  lastAnnouncedHash = "";
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
        await again(
          "Started a site with a master layout, a standard page, a Hello world home page, and a blog with one article.",
          "",
        );
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
  if (kind === "content") {
    window.location.hash = "#/pages";
    return;
  }
  const listing = await listRecords();
  const active = activeRecordKind(listing, kind);
  const layoutNotes = active === "layouts" ? await loadLayoutListNotes(listing) : new Map<string, string>();
  const bindingInfo = active === "bindings" ? await loadBindingListInfo(listing) : undefined;
  const itemZones = active === "items" ? await loadItemZones(listing) : [];
  const listNotes = bindingInfo?.notes ?? layoutNotes;
  root.innerHTML = chrome(user, listHtml(listing, kind, notice, error, listNotes, itemZones), true, "records");
  bindChrome(root);
  bindInitSite(root, (nextNotice, nextError) => bindList(root, user, kind, nextNotice, nextError));
  if (active === "blogs") bindBlogs(root, user, listing);
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
    void createPage(root, listing);
  });
  root.querySelector("[data-action=new-template]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-template-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-template-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-template-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createTemplate(root, listing);
  });
  root.querySelector("[data-action=new-layout]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-layout-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-layout-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-layout-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createLayout(root, listing);
  });
  root.querySelector("[data-action=new-type]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-type-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-type-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-type-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createType(root, listing);
  });
  const newItem = root.querySelector<HTMLFormElement>("#new-item-form");
  newItem?.querySelector("#new-item-zone")?.addEventListener("change", () => {
    if (newItem) syncNewItemContent(newItem);
  });
  newItem?.querySelector("#new-item-content")?.addEventListener("change", () => {
    if (newItem) syncNewItemContent(newItem);
  });
  root.querySelector("[data-action=new-item]")?.addEventListener("click", () => {
    if (!newItem) return;
    newItem.hidden = false;
    syncNewItemContent(newItem);
    newItem.querySelector<HTMLInputElement>("#new-item-id")?.focus();
  });
  newItem?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createItem(root, listing);
  });
  if (bindingInfo) bindNewBinding(root, listing, bindingInfo.choices);
}

async function createPage(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-page-form");
  if (!form) return;
  const title = form.querySelector<HTMLInputElement>("#new-page-title")?.value ?? "";
  const sidebar = form.querySelector<HTMLInputElement>("[name=sidebar]")?.checked ?? false;
  const existing = listing.records.filter((row) => row.kind === "content").map((row) => row.id);
  const templateId = form.querySelector<HTMLSelectElement>("#new-page-template")?.value ?? "";
  await createRecord({
    kind: "content",
    form,
    idField: "#new-page-id",
    existingIds: existing,
    validateId: pageIdError,
    buildBody: async (pageId) => {
      const pageTitle = title.trim() || pageId;
      return templateId
        ? pageFromTemplate(pageId, pageTitle, templateId, await templateRecord(templateId))
        : newPageBody(pageId, pageTitle);
    },
    save: saveRecord,
    destinationMode: "compose",
    destinationHash: (pageId) => `#/content/${encodeURIComponent(pageId)}`,
    successMessage: (pageId) => `Created ${title.trim() || pageId}.`,
    failureMessage: "Could not create the page.",
    showError: showFormError,
    afterSave: async (pageId, notice) => {
      if (!sidebar) return notice;
      const pageTitle = title.trim() || pageId;
      try {
        const nav = await getRecord("nav", "nav");
        const linked = withSidebarLink(nav.data, pageId, pageTitle);
        if (!linked.ok) return `${notice} ${linked.message}`;
        await saveRecord("nav", "nav", linked.nav);
        return notice;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not add it to the sidebar.";
        return `${notice} ${message}`;
      }
    },
    navigate: (destination) => navigateToCreatedRecord(root, destination),
  });
}

async function templateRecord(id: string): Promise<Record<string, unknown>> {
  const payload = await getRecord("templates", id);
  const data = asRecord(payload.data);
  if (!data) throw new Error("That template could not be read.");
  return data;
}

async function createTemplate(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-template-form");
  if (!form) return;
  const existing = listing.records.filter((row) => row.kind === "templates").map((row) => row.id);
  await createRecord({
    kind: "templates",
    form,
    idField: "#new-template-id",
    existingIds: existing,
    validateId: pageIdError,
    buildBody: newTemplateBody,
    save: saveRecord,
    destinationMode: "compose",
    destinationHash: (id) => `#/templates/${encodeURIComponent(id)}`,
    successMessage: (id) => `Created ${id}.`,
    failureMessage: "Could not create the template.",
    showError: showFormError,
    navigate: (destination) => navigateToCreatedRecord(root, destination),
  });
}

async function createLayout(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-layout-form");
  if (!form) return;
  const existing = listing.records.filter((row) => row.kind === "layouts").map((row) => row.id);
  const frame = form.querySelector<HTMLSelectElement>("#new-layout-kind")?.value === "frame";
  await createRecord({
    kind: "layouts",
    form,
    idField: "#new-layout-id",
    existingIds: existing,
    validateId: (id, ids) => pageIdError(id, ids)?.replace("A page with id", "A layout with id"),
    buildBody: (id) => frame ? newFrame(id) : newPageLayout(id),
    save: saveRecord,
    destinationMode: "arrange",
    destinationHash: (id) => `#/layouts/${encodeURIComponent(id)}`,
    successMessage: (id) => `Created ${id}.`,
    failureMessage: "Could not create the layout.",
    showError: showFormError,
    navigate: (destination) => navigateToCreatedRecord(root, destination),
  });
}

async function createItem(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-item-form");
  if (!form) return;
  const zone = form.querySelector<HTMLSelectElement>("#new-item-zone")?.value ?? "";
  const zoneProblem = itemZoneError(zone);
  if (zoneProblem) {
    showFormError(form, zoneProblem);
    return;
  }
  const content = itemContent(form.querySelector<HTMLSelectElement>("#new-item-content")?.value ?? "");
  const componentName = form.querySelector<HTMLInputElement>("#new-item-component")?.value ?? "";
  if (zone && content === "component" && !componentName.trim()) {
    showFormError(form, "Enter a component name.");
    return;
  }
  const existing = listing.records.filter((row) => row.kind === "items").map((row) => row.id);
  await createRecord({
    kind: "items",
    form,
    idField: "#new-item-id",
    existingIds: existing,
    validateId: (id, ids) => pageIdError(id, ids)?.replace("A page with id", "An item with id"),
    buildBody: (id) => newItemBody(id, zone, content, componentName),
    save: saveRecord,
    destinationMode: "fields",
    destinationHash: (id) => `#/items/${encodeURIComponent(id)}`,
    successMessage: (id) => `Created ${id}.`,
    failureMessage: "Could not create the item.",
    showError: showFormError,
    navigate: (destination) => navigateToCreatedRecord(root, destination),
  });
}

async function createType(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-type-form");
  if (!form) return;
  const existing = listing.records.filter((row) => row.kind === "types").map((row) => row.id);
  await createRecord({
    kind: "types",
    form,
    idField: "#new-type-id",
    existingIds: existing,
    validateId: (id, ids) => pageIdError(id, ids)?.replace("A page with id", "A type with id"),
    buildBody: newTypeBody,
    save: saveRecord,
    destinationMode: "fields",
    destinationHash: (id) => `#/types/${encodeURIComponent(id)}`,
    successMessage: (id) => `Created ${id}.`,
    failureMessage: "Could not create the type.",
    showError: showFormError,
    navigate: (destination) => navigateToCreatedRecord(root, destination),
  });
}

async function navigateToCreatedRecord(root: HTMLElement, destination: CreateRecordDestination): Promise<void> {
  pendingEdit = { mode: destination.mode, notice: destination.notice };
  if (window.location.hash === destination.hash) await render(root);
  else window.location.hash = destination.hash;
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
    if (error) showFormError(form, error);
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
        showFormError(form, problem);
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
    showFormError(form, problem);
    return;
  }
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  const id = state.id.trim();
  try {
    await saveRecord("bindings", id, newBindingRecord(state));
  } catch (err) {
    showFormError(form, err instanceof Error ? err.message : "Could not create the binding.");
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

function showFormError(form: HTMLFormElement, message: string): void {
  const error = form.querySelector<HTMLElement>("[data-form-error]");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}


async function heroPreviewUrl(id: string): Promise<string | undefined> {
  if (!id) return undefined;
  try {
    const listing = await getLibrary();
    const url = listing.assets.find((asset) => asset.id === id)?.url;
    return url ? editorMediaSrc(url) : undefined;
  } catch {
    return undefined;
  }
}

function setHero(form: HTMLFormElement, id: string, url?: string): void {
  const input = form.querySelector<HTMLInputElement>('[name="fields.hero"]');
  if (input) input.value = id;
  const name = form.querySelector<HTMLElement>("[data-hero-name]");
  if (name) name.textContent = id || "No image.";
  const preview = form.querySelector("[data-hero-preview]");
  if (preview instanceof HTMLImageElement) {
    if (url) {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  } else if (preview instanceof HTMLElement && url) {
    preview.outerHTML = `<img data-hero-preview src="${escapeHtml(url)}" alt="" />`;
  }
  form.dataset.dirty = "true";
}

async function pickHero(form: HTMLFormElement): Promise<void> {
  const picked = await openLibraryPicker("image");
  if (!picked || !("url" in picked)) return;
  setHero(form, picked.id, editorMediaSrc(picked.url));
}

async function uploadHero(form: HTMLFormElement): Promise<void> {
  const file = form.querySelector<HTMLInputElement>("[data-hero-file]")?.files?.[0];
  if (!file) return;
  const body = new FormData();
  body.append("file", file);
  body.append("path", file.name);
  body.append("folderId", "articles");
  const result = await uploadLibrary(body);
  const created = result.created[0];
  if (!created) {
    const reason = result.skipped[0]?.reason ?? "Upload failed.";
    showFormError(form, reason);
    return;
  }
  const url = await heroPreviewUrl(created.id);
  setHero(form, created.id, url);
}

async function contentPages(): Promise<PageChoice[]> {
  const listing = await listRecords();
  return listing.records
    .filter((row) => row.kind === "content" && row.type !== "article" && row.type !== "blog-index")
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
        "Replace this site with a fresh starter? It has a Hello world home page and a blog with one article. Your editors stay. The current site is saved as a new backup first.",
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
    ${statusPanels(notice, error)}
    <p><button type="button" class="w3-button w3-theme" data-action="backup">Back up now</button></p>
    ${rows}
    <h2 class="w3-medium">Examples</h2>
    ${examples}
    <h2 class="w3-medium">Re-seed</h2>
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
    ${statusPanels(notice, error)}
    ${body}`;
}

function startSiteHtml(): string {
  return `<p><button type="button" class="w3-button w3-theme" data-action="init-site">Start an empty site</button></p>`;
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
  "blogs",
  "templates",
  "bindings",
  "items",
  "types",
  "layouts",
];

function recordTabs(listing: RecordList): { kind: string; label: string }[] {
  const rank = new Map(RECORD_TAB_ORDER.map((kind, index) => [kind, index]));
  const tabs = listing.kinds
    .filter((item) => !LIBRARY_RECORD_KINDS.has(item.kind) && item.kind !== "content")
    .sort((a, b) => (rank.get(a.kind) ?? RECORD_TAB_ORDER.length) - (rank.get(b.kind) ?? RECORD_TAB_ORDER.length));
  const nav = tabs.findIndex((item) => item.kind === "nav");
  tabs.splice(nav + 1, 0, { kind: "blogs", label: "Blogs" });
  return tabs;
}

function activeRecordKind(listing: RecordList, selected?: string): string | undefined {
  if (selected === "blogs") return "blogs";
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
  itemZones: readonly string[] = [],
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
    ${statusPanels(notice, error)}
    ${siteReady ? "" : startSiteHtml()}
    <nav class="editor-tabs" aria-label="Record types">${tabs}</nav>
    ${recordTab(listing, active, byKind, siteReady, layoutNotes, itemZones)}`;
}

function recordTab(
  listing: RecordList,
  active: string | undefined,
  byKind: Map<string, RecordSummary[]>,
  siteReady: boolean,
  layoutNotes: Map<string, string> = new Map(),
  itemZones: readonly string[] = [],
): string {
  if (active === "blogs") {
    return `<section class="editor-kind" aria-label="Blogs">${blogsSection(listing)}</section>`;
  }
  const kind = listing.kinds.find((item) => item.kind === active);
  if (!kind) return `<p class="w3-text-grey">That record type is not in this editor.</p>`;
  const rows = byKind.get(kind.kind) ?? [];
  const body =
    kind.kind === "content"
      ? contentSection(
          sortPages(rows, readPageListOrder(), { creationRank: buildContentCreationRank(listing.records) }),
          byKind.get("templates") ?? [],
          siteReady,
          readPageListOrder(),
        )
      : kind.kind === "templates"
        ? templateSection(rows, siteReady)
        : kind.kind === "layouts"
          ? layoutSection(rows, siteReady, layoutNotes)
          : kind.kind === "types"
            ? typeSection(rows, siteReady)
            : kind.kind === "bindings"
              ? bindingSection(rows, siteReady, layoutNotes)
              : kind.kind === "items"
                ? itemSection(rows, siteReady, itemZones)
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
      <p><label for="new-layout-kind">Kind</label>
        <select id="new-layout-kind" name="kind" class="w3-select w3-border w3-margin-top">
          <option value="page">Page layout</option>
          <option value="frame">Frame</option>
        </select>
      </p>
      ${formErrorPanel()}
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

/** Zone ids declared by the site’s layouts, in list order. A layout that fails to load is skipped. */
async function loadItemZones(listing: RecordList): Promise<string[]> {
  const layouts = listing.records.filter((row) => row.kind === "layouts");
  if (!layouts.length) return [];
  const settled = await Promise.allSettled(layouts.map((row) => getRecord("layouts", row.id)));
  const roots = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const root = asLayoutNode(asRecord(result.value.data)?.root);
    if (root) roots.push(root);
  }
  return zonesDeclaredBy(roots);
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

function filterPageRows(listing: RecordList): RecordSummary[] {
  return listing.records.filter(
    (row) => row.kind === "content" && row.type !== "article" && row.type !== "blog" && row.type !== "blog-index",
  );
}

async function loadSiteData(listing: RecordList): Promise<Record<string, unknown> | undefined> {
  const siteRow = listing.records.find((row) => row.kind === "site");
  if (!siteRow) return undefined;
  try {
    const sitePayload = await getRecord("site", siteRow.id);
    return asRecord(sitePayload.data);
  } catch {
    return undefined;
  }
}

async function loadNavSortDocument(listing: RecordList, siteData: Record<string, unknown>) {
  try {
    const navPayload = await getRecord("nav", "nav");
    const nav = Array.isArray(navPayload.data) ? (navPayload.data as NavEntry[]) : [];
    const contentForNav = listing.records.filter((row) => row.kind === "content" && row.type !== "article");
    const items = listing.records.filter((row) => row.kind === "items");
    return buildNavSortDocument(siteData, nav, contentForNav, items);
  } catch {
    return undefined;
  }
}

function listedHomePageId(siteData: Record<string, unknown> | undefined): string {
  return typeof siteData?.homePageId === "string" ? siteData.homePageId.trim() : "";
}

async function listedPages(
  listing: RecordList,
  order: PageListOrder,
): Promise<{ listed: ListedPage[]; homePageId: string }> {
  const rows = filterPageRows(listing);
  const creationRank = buildContentCreationRank(listing.records);
  const siteData = await loadSiteData(listing);
  const homePageId = listedHomePageId(siteData);
  const navDocument = order === "nav" && siteData ? await loadNavSortDocument(listing, siteData) : undefined;
  return {
    listed: sortPages(rows, order, { creationRank, navDocument, homePageId }),
    homePageId,
  };
}

async function bindPages(root: HTMLElement, user: PublicUser, notice = "", error = ""): Promise<void> {
  const listing = await listRecords();
  const listOrder = readPageListOrder();
  const { listed, homePageId } = await listedPages(listing, listOrder);
  const templates = listing.records.filter((row) => row.kind === "templates");
  const siteReady = listing.records.some((row) => row.kind === "site");
  root.innerHTML = chrome(
    user,
    `<h1 class="w3-large">Pages</h1>${statusPanels(notice, error)}${contentSection(listed, templates, siteReady, listOrder, homePageId)}`,
    true,
    "pages",
  );
  bindChrome(root);
  bindEntryFilter(root);
  bindPageListOrder(root, listing);
  root.querySelector("[data-action=new-page]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-page-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-page-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-page-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createPage(root, listing);
  });
}

function bindPageListOrder(root: HTMLElement, listing: RecordList): void {
  const select = root.querySelector<HTMLSelectElement>("#page-list-order");
  select?.addEventListener("change", () => {
    const order = select.value as PageListOrder;
    if (order !== "created" && order !== "alpha" && order !== "nested" && order !== "nav") return;
    writePageListOrder(order);
    void (async () => {
      const { listed, homePageId } = await listedPages(listing, order);
      const list = root.querySelector<HTMLUListElement>("#entry-list");
      if (list) list.outerHTML = entryRecordList(listed, undefined, homePageId);
      applyEntryFilter(root);
    })();
  });
}

async function bindArticles(root: HTMLElement, user: PublicUser, blog?: string, notice = "", error = ""): Promise<void> {
  const listing = await listRecords();
  if (!blog) {
    const blogs = listing.records.filter((row) => row.kind === "content" && row.type === "blog");
    if (blogs.length === 1) {
      const next = `#/articles/${encodeURIComponent(blogs[0]!.id)}`;
      if (window.location.hash !== next) {
        window.location.hash = next;
        return;
      }
    }
  }
  const listOrder = readArticleListOrder();
  root.innerHTML = chrome(user, articlesHtml(listing, blog, notice, error, listOrder), true, "articles");
  bindChrome(root);
  const filter = root.querySelector<HTMLInputElement>("#article-tag");
  const list = root.querySelector<HTMLUListElement>("#article-list");
  const applyArticleTagFilter = () => {
    const needle = filter?.value.trim().toLowerCase() ?? "";
    let shown = 0;
    list?.querySelectorAll("li").forEach((item) => {
      const tags = (item.getAttribute("data-tags") ?? "").toLowerCase();
      const hide = Boolean(needle) && !tags.split("\u001f").some((tag) => tag.includes(needle));
      (item as HTMLElement).hidden = hide;
      if (!hide) shown += 1;
    });
    const empty = root.querySelector<HTMLElement>("#article-filter-empty");
    if (empty) empty.hidden = shown !== 0;
  };
  filter?.addEventListener("input", applyArticleTagFilter);
  root.querySelector<HTMLSelectElement>("#article-list-order")?.addEventListener("change", (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement) || !blog || !list) return;
    const order = select.value as ArticleListOrder;
    if (order !== "created" && order !== "date" && order !== "alpha") return;
    writeArticleListOrder(order);
    const articles = blogArticles(listing, blog, order);
    list.innerHTML = renderArticleListItems(articles);
    applyArticleTagFilter();
  });
  root.querySelector("[data-action=new-article]")?.addEventListener("click", () => {
    const form = root.querySelector<HTMLFormElement>("#new-article-form");
    if (!form) return;
    form.hidden = false;
    form.querySelector<HTMLInputElement>("#new-article-id")?.focus();
  });
  root.querySelector<HTMLFormElement>("#new-article-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (blog) void createArticle(root, listing, blog);
  });
}

function blogArticles(listing: RecordList, blog: string, order: ArticleListOrder): RecordSummary[] {
  const rows = listing.records.filter(
    (row) => row.kind === "content" && row.type === "article" && row.parentId === blog,
  );
  return sortArticles(rows, order, buildContentCreationRank(listing.records));
}

function renderArticleListItems(articles: RecordSummary[]): string {
  return articles
    .map((row) => {
      const when = row.date ? ` <span class="w3-text-grey w3-small">${escapeHtml(row.date)}</span>` : "";
      return `<li data-tags="${escapeHtml((row.tags ?? []).join("\u001f"))}"><a href="#/content/${encodeURIComponent(row.id)}">${escapeHtml(row.title ?? row.id)}</a>${when}</li>`;
    })
    .join("");
}

function articleTagFilter(): string {
  return `<p class="editor-list-order"><label for="article-tag">Tag</label>
    <input id="article-tag" class="w3-input w3-border" autocomplete="off" /></p>`;
}

function articleListOrderSelect(order: ArticleListOrder): string {
  return `<p class="editor-list-order"><label for="article-list-order">List order</label>
    <select id="article-list-order" class="w3-select w3-border">
      <option value="created"${order === "created" ? " selected" : ""}>Recently added</option>
      <option value="date"${order === "date" ? " selected" : ""}>Publish date</option>
      <option value="alpha"${order === "alpha" ? " selected" : ""}>A–Z</option>
    </select></p>`;
}

function articlesHtml(
  listing: RecordList,
  blog: string | undefined,
  notice: string,
  error: string,
  listOrder: ArticleListOrder = readArticleListOrder(),
): string {
  const blogs = listing.records.filter((row) => row.kind === "content" && row.type === "blog");
  if (!blog) {
    const items = blogs.length
      ? `<ul class="w3-ul">${blogs
          .map(
            (row) =>
              `<li><a href="#/articles/${encodeURIComponent(row.id)}">${escapeHtml(row.title ?? row.id)}</a> <span class="w3-text-grey w3-small">${escapeHtml(row.id)}</span></li>`,
          )
          .join("")}</ul>`
      : `<p class="w3-text-grey">No blogs yet. Add one under <a href="#/records/blogs">Records → Blogs</a>.</p>`;
    return `<h1 class="w3-large">Articles</h1>${statusPanels(notice, error)}${items}`;
  }
  if (!blogs.some((row) => row.id === blog)) {
    return `<h1 class="w3-large">Articles</h1><p>That blog is not a record. <a href="#/articles">Back</a></p>`;
  }
  const blogRow = blogs.find((row) => row.id === blog);
  const articles = blogArticles(listing, blog, listOrder);
  const items = renderArticleListItems(articles);
  return `<h1 class="w3-large">Articles</h1>
    ${statusPanels(notice, error)}
    <p><a href="#/articles">Blogs</a> · ${escapeHtml(blogRow?.title ?? blog)}</p>
    <p><button type="button" class="w3-button w3-theme" data-action="new-article">New article</button></p>
    <form id="new-article-form" class="editor-new-page" hidden>
      <p><label for="new-article-id">Id</label>
        <input id="new-article-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" /></p>
      <p><label for="new-article-title">Title</label>
        <input id="new-article-title" name="title" class="w3-input w3-border w3-margin-top" required /></p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create article</button></p>
    </form>
    ${articleTagFilter()}
    ${articleListOrderSelect(listOrder)}
    ${items ? `<ul class="w3-ul" id="article-list">${items}</ul><p id="article-filter-empty" class="w3-text-grey" hidden>No articles with that tag.</p>` : `<p class="w3-text-grey">No articles for this blog yet.</p>`}`;
}

async function createArticle(root: HTMLElement, listing: RecordList, blogId: string): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-article-form");
  if (!form) return;
  const title = form.querySelector<HTMLInputElement>("#new-article-title")?.value ?? "";
  const existing = listing.records.filter((row) => row.kind === "content").map((row) => row.id);
  await createRecord({
    kind: "content",
    form,
    idField: "#new-article-id",
    existingIds: existing,
    validateId: pageIdError,
    buildBody: (pageId) => {
      const pageTitle = title.trim() || pageId;
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      return {
        id: pageId,
        title: pageTitle,
        type: "article",
        parentId: blogId,
        fields: { date },
        zones: { main: { html: "" } },
      };
    },
    save: saveRecord,
    destinationMode: "compose",
    destinationHash: (pageId) => `#/content/${encodeURIComponent(pageId)}`,
    successMessage: (pageId) => `Created ${pageId}.`,
    failureMessage: "Could not create that article.",
    showError: showFormError,
    navigate: (destination) => {
      pendingEdit = { mode: destination.mode, notice: destination.notice };
      window.location.hash = destination.hash;
    },
  });
}

function blogsSection(listing: RecordList): string {
  const blogs = listing.records.filter((row) => row.kind === "content" && row.type === "blog");
  const rows = blogs
    .map((blog) => {
      return `<li>
        <a href="#/content/${encodeURIComponent(blog.id)}"><strong>${escapeHtml(blog.title ?? blog.id)}</strong></a>
        <span class="w3-text-grey w3-small"> ${escapeHtml(blog.id)}</span>
        <form data-rename-blog="${escapeHtml(blog.id)}" class="editor-inline">
          <input name="next" class="w3-input w3-border" aria-label="New id for ${escapeHtml(blog.id)}" placeholder="New id" />
          <button type="submit" class="w3-button w3-white">Rename</button>
        </form>
        <button type="button" class="w3-button w3-white" data-delete-blog="${escapeHtml(blog.id)}">Delete</button>
        <button type="button" class="w3-button w3-white" data-cascade-blog="${escapeHtml(blog.id)}">Cascade delete</button>
      </li>`;
    })
    .join("");
  return `${rows ? `<ul class="w3-ul">${rows}</ul>` : `<p class="w3-text-grey">No blogs yet.</p>`}
    <h2 class="w3-medium">New blog</h2>
    <form id="new-blog-form">
      <p><label for="new-blog-id">Id</label>
        <input id="new-blog-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" /></p>
      <p><label for="new-blog-title">Title</label>
        <input id="new-blog-title" name="title" class="w3-input w3-border w3-margin-top" required /></p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create blog</button></p>
    </form>`;
}

function bindBlogs(root: HTMLElement, user: PublicUser, listing: RecordList): void {
  root.querySelector<HTMLFormElement>("#new-blog-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void createBlog(root, listing);
  });
  root.querySelectorAll<HTMLFormElement>("[data-rename-blog]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = form.dataset.renameBlog ?? "";
      const next = form.querySelector<HTMLInputElement>("[name=next]")?.value.trim() ?? "";
      void renameBlog(id, next)
        .then(() => bindList(root, user, "blogs", `Renamed ${id} to ${next}.`))
        .catch((err: unknown) => bindList(root, user, "blogs", "", err instanceof Error ? err.message : "Could not rename that blog."));
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-delete-blog]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteBlog ?? "";
      void deleteBlog(id)
        .then(() => bindList(root, user, "blogs", `Deleted ${id}.`))
        .catch((err: unknown) => bindList(root, user, "blogs", "", err instanceof Error ? err.message : "Could not delete that blog."));
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-cascade-blog]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.cascadeBlog ?? "";
      if (!id) return;
      if (!window.confirm(`Delete blog ${id}, its index, and every article that belongs to it?`)) return;
      void cascadeBlog(id)
        .then(() => bindList(root, user, "blogs", `Cascade-deleted ${id}.`))
        .catch((err: unknown) => bindList(root, user, "blogs", "", err instanceof Error ? err.message : "Could not delete that blog."));
    });
  });
}

async function createBlog(root: HTMLElement, listing: RecordList): Promise<void> {
  const form = root.querySelector<HTMLFormElement>("#new-blog-form");
  if (!form) return;
  const title = form.querySelector<HTMLInputElement>("#new-blog-title")?.value ?? "";
  const existing = listing.records.filter((row) => row.kind === "content").map((row) => row.id);
  await createRecord({
    kind: "content",
    form,
    idField: "#new-blog-id",
    existingIds: existing,
    validateId: pageIdError,
    buildBody: (id) => {
      const pageTitle = title.trim() || id;
      return {
        id,
        title: pageTitle,
        type: "blog",
        fields: { pageSize: "10" },
        zones: { title: { html: pageTitle }, lead: { html: "" } },
      };
    },
    save: saveRecord,
    destinationMode: "fields",
    destinationHash: (id) => `#/content/${encodeURIComponent(id)}`,
    successMessage: (id) => `Created ${id} and its index.`,
    failureMessage: "Could not create that blog.",
    showError: showFormError,
    navigate: (destination) => {
      pendingEdit = { mode: destination.mode, notice: destination.notice };
      window.location.hash = destination.hash;
    },
  });
}

function pageListOrderSelect(order: PageListOrder): string {
  return `<p class="editor-list-order"><label for="page-list-order">List order</label>
    <select id="page-list-order" class="w3-select w3-border">
      <option value="created"${order === "created" ? " selected" : ""}>Recently added</option>
      <option value="alpha"${order === "alpha" ? " selected" : ""}>A–Z</option>
      <option value="nested"${order === "nested" ? " selected" : ""}>Nested</option>
      <option value="nav"${order === "nav" ? " selected" : ""}>Nav order</option>
    </select></p>`;
}

function contentSection(
  listed: ListedPage[],
  templates: RecordSummary[],
  siteReady: boolean,
  listOrder: PageListOrder,
  homePageId = "",
): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  const options = templates
    .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.title ?? row.id)}</option>`)
    .join("");
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-page">New page</button></p>
    <form id="new-page-form" class="editor-new-page" hidden>
      <p><label for="new-page-id">Id</label>
        <input id="new-page-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p><label for="new-page-title">Title</label>
        <input id="new-page-title" name="title" class="w3-input w3-border w3-margin-top" required />
      </p>
      <p><label for="new-page-template">Template</label>
        <select id="new-page-template" name="template" class="w3-select w3-border w3-margin-top">
          <option value="">Free form</option>
          ${options}
        </select>
      </p>
      <p class="editor-check"><label><input name="sidebar" type="checkbox" checked /> Include in the sidebar</label></p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create page</button></p>
    </form>
    ${listed.length ? `${entryFilter()}${pageListOrderSelect(listOrder)}${entryRecordList(listed, undefined, homePageId)}<p id="entry-filter-empty" class="w3-text-grey" hidden>No entries match.</p>` : `<p class="w3-text-grey">No records yet.</p>`}`;
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

function applyEntryFilter(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>("#entry-filter");
  const list = root.querySelector<HTMLUListElement>("#entry-list");
  const empty = root.querySelector<HTMLElement>("#entry-filter-empty");
  if (!bar || !list) return;
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
}

function bindEntryFilter(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>("#entry-filter");
  if (!bar) return;
  bar.addEventListener("input", () => applyEntryFilter(root));
  bar.querySelector("[data-action=clear-entry-filter]")?.addEventListener("click", () => {
    for (const input of bar.querySelectorAll("input")) input.value = "";
    applyEntryFilter(root);
  });
}

function itemSection(rows: RecordSummary[], siteReady: boolean, zones: readonly string[] = []): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  const zoneOptions = zones
    .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`)
    .join("");
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-item">New item</button></p>
    <form id="new-item-form" class="editor-new-page" hidden>
      <p><label for="new-item-id">Id</label>
        <input id="new-item-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      <p><label for="new-item-zone">Zone</label>
        <select id="new-item-zone" name="zone" class="w3-select w3-border w3-margin-top">
          <option value="">-- none --</option>
          ${zoneOptions}
        </select>
      </p>
      <p data-item-fill hidden><label for="new-item-content">Content</label>
        <select id="new-item-content" name="content" class="w3-select w3-border w3-margin-top">
          <option value="html">HTML</option>
          <option value="json">JSON</option>
          <option value="component">Component</option>
          <option value="blocks">Blocks</option>
        </select>
      </p>
      <p data-item-component hidden><label for="new-item-component">Component</label>
        <input id="new-item-component" name="component" class="w3-input w3-border w3-margin-top" autocomplete="off" spellcheck="false" placeholder="eventList" />
      </p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create item</button></p>
    </form>
    ${rows.length ? recordList(rows) : `<p class="w3-text-grey">No items yet.</p>`}`;
}

function typeSection(rows: RecordSummary[], siteReady: boolean): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-type">New type</button></p>
    <form id="new-type-form" class="editor-new-page" hidden>
      <p><label for="new-type-id">Id</label>
        <input id="new-type-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      ${formErrorPanel()}
      <p><button type="submit" class="w3-button w3-theme">Create type</button></p>
    </form>
    ${rows.length ? recordList(rows) : `<p class="w3-text-grey">No types yet.</p>`}`;
}

function bindingSection(rows: RecordSummary[], siteReady: boolean, notes: Map<string, string>): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-binding">New binding</button></p>
    <form id="new-binding-form" class="editor-new-page" hidden></form>
    ${rows.length ? recordList(rows, false, (row) => notes.get(row.id) ?? "") : `<p class="w3-text-grey">No bindings yet.</p>`}`;
}

function templateSection(rows: RecordSummary[], siteReady: boolean): string {
  if (!siteReady) return `<p class="w3-text-grey">No records yet.</p>`;
  return `<p><button type="button" class="w3-button w3-theme" data-action="new-template">New template</button></p>
    <form id="new-template-form" class="editor-new-page" hidden>
      <p><label for="new-template-id">Id</label>
        <input id="new-template-id" name="id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" />
      </p>
      ${formErrorPanel()}
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

function readLayoutDocument(
  form: HTMLFormElement,
  mode: EditMode,
  current: Record<string, unknown>,
  baselineRaw: string,
  baselineData: unknown,
):
  | { ok: true; draft: Record<string, unknown>; baseline: boolean }
  | { ok: false; error: string } {
  if (mode === "raw") {
    const text = form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "";
    if (text === baselineRaw) return { ok: true, draft: current, baseline: true };
    try {
      const parsed = parseYaml(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "This layout file must be a YAML mapping." };
      }
      return { ok: true, draft: parsed as Record<string, unknown>, baseline: false };
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
    try {
      const read = readFormValues(form, schemaFor("layouts", current), current);
      if (!read || typeof read !== "object" || Array.isArray(read)) return { ok: false, error: "Could not read this layout." };
      draft = read as Record<string, unknown>;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not read this layout." };
    }
  }
  return { ok: true, draft, baseline: !layoutDraftChanged(draft, baselineData) };
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
  const read = readLayoutDocument(form, mode, current, baselineRaw, baselineData);
  if (!read.ok) return read;
  if (read.baseline) return { ok: true, unchanged: true };
  return { ok: true, unchanged: false, draft: read.draft, fromEditor: mode !== "raw" };
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

function homeListBoundaryIndex(listed: readonly ListedPage[], homePageId: string): number {
  if (!homePageId) return -1;
  const start = listed.findIndex((item) => item.row.id === homePageId);
  if (start < 0) return -1;
  const baseDepth = listed[start]!.depth;
  let end = start + 1;
  while (end < listed.length && listed[end]!.depth > baseDepth) end += 1;
  return end - 1;
}

function entryRecordList(
  listed: ListedPage[],
  noteFor?: (row: RecordSummary) => string,
  homePageId = "",
): string {
  const boundary = homeListBoundaryIndex(listed, homePageId);
  return `<ul class="w3-ul" id="entry-list">
    ${listed
      .map(({ row, depth }, index) => entryListItem(row, depth, noteFor, index === boundary))
      .join("")}
  </ul>`;
}

function entryListItem(
  row: RecordSummary,
  depth: number,
  noteFor?: (row: RecordSummary) => string,
  homeBoundary = false,
): string {
  const label = row.title ?? row.id;
  const idNote =
    row.title && row.title !== row.id ? ` <span class="w3-text-grey w3-small">${escapeHtml(row.id)}</span>` : "";
  const typeNote = row.type ? ` <span class="w3-text-grey w3-small">${escapeHtml(row.type)}</span>` : "";
  const extra = noteFor?.(row);
  const extraNote = extra ? ` <span class="w3-text-grey w3-small">${escapeHtml(extra)}</span>` : "";
  const style = depth > 0 ? ` style="padding-left: calc(0.75rem + ${depth} * 1.25rem)"` : "";
  const homeClass = homeBoundary ? ` class="editor-entry-home-boundary"` : "";
  return `<li${homeClass}${style} data-type="${escapeHtml(row.type ?? "")}" data-tags="${escapeHtml((row.tags ?? []).join("\u001f"))}" data-title="${escapeHtml(row.title ?? row.id)}"><a href="#/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}">${escapeHtml(label)}</a>${idNote}${typeNote}${extraNote}</li>`;
}

function recordList(rows: RecordSummary[], entries = false, noteFor?: (row: RecordSummary) => string): string {
  if (entries) {
    return entryRecordList(
      rows.map((row) => ({ row, depth: 0 })),
      noteFor,
    );
  }
  return `<ul class="w3-ul">
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
        return `<li><a href="#/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.id)}">${escapeHtml(label)}</a>${idNote}${typeNote}${extraNote}</li>`;
      })
      .join("")}
  </ul>`;
}

function snapshotYaml(form: HTMLFormElement, mode: EditMode, session: ContentSession, kind: string): string | undefined {
  if (editsBody(kind)) {
    if (mode !== "compose" && mode !== "fields" && mode !== "raw") return undefined;
    const read = readContentDocument(form, mode, session.draft, session.payload.raw, session.payload.data, kind);
    if (!read.ok) return undefined;
    return read.fromEditor ? draftYaml(read.draft) : session.payload.raw;
  }
  if (kind !== "layouts") return undefined;
  const read = readLayoutDocument(form, mode, session.draft, session.payload.raw, session.payload.data);
  if (!read.ok) return undefined;
  return read.baseline ? session.payload.raw : draftYaml(read.draft);
}

function applyPresent(session: ContentSession): boolean {
  const text = session.undo.present;
  const baseline = session.payload.raw;
  if (text === baseline || text.trimEnd() === baseline.trimEnd()) {
    const data = asRecord(session.payload.data);
    if (data) {
      session.draft = structuredClone(data);
      session.fromEditor = false;
      return true;
    }
  }
  const parsed = parsePageYaml(text);
  if (!parsed.ok) return false;
  session.draft = parsed.data;
  session.fromEditor = true;
  return true;
}

function syncUndoButtons(scope: ParentNode, history: UndoHistory): void {
  const undoButton = scope.querySelector<HTMLButtonElement>("[data-action=undo]");
  const redoButton = scope.querySelector<HTMLButtonElement>("[data-action=redo]");
  if (undoButton) undoButton.disabled = !canUndo(history);
  if (redoButton) redoButton.disabled = !canRedo(history);
}

function canvasOwnsEdit(mode: EditMode, target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (mode === "arrange") return target.dataset.field !== undefined;
  if (mode === "compose") return !!target.closest("[data-canvas], [data-item-id]");
  return false;
}

function typingBurst(target: EventTarget | null): string | undefined {
  if (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio")
  ) {
    return target.name || target.id || "text";
  }
  return undefined;
}

function sessionFor(kind: string): ContentSession | undefined {
  return editsBody(kind) ? contentSession : kind === "layouts" ? layoutSession : undefined;
}

async function restoreHistory(
  root: HTMLElement,
  user: PublicUser,
  kind: string,
  id: string,
  mode: EditMode,
  host: "page" | "tab",
  direction: "undo" | "redo",
): Promise<void> {
  const session = sessionFor(kind);
  if (!session || historyRestore) return;
  const moved = direction === "undo" ? undo(session.undo) : redo(session.undo);
  if (!moved) return;
  if (!applyPresent(session)) {
    if (direction === "undo") redo(session.undo);
    else undo(session.undo);
    return;
  }
  historyRestore = true;
  try {
    await bindEdit(root, user, kind, id, mode, "", true, host);
  } finally {
    historyRestore = false;
  }
}

function bindUndoKeys(
  form: HTMLFormElement,
  root: HTMLElement,
  user: PublicUser,
  kind: string,
  id: string,
  mode: EditMode,
  host: "page" | "tab",
): void {
  undoKeys?.abort();
  undoKeys = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      if (!form.isConnected) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const undoKey = event.code === "KeyZ" && !event.shiftKey;
      const redoKey = (event.code === "KeyZ" && event.shiftKey) || (event.code === "KeyY" && !event.shiftKey);
      if (!undoKey && !redoKey) return;
      event.preventDefault();
      void restoreHistory(root, user, kind, id, mode, host, undoKey ? "undo" : "redo");
    },
    { signal: undoKeys.signal },
  );
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
      contentSession = { key, payload, draft: structuredClone(loaded), fromEditor: false, undo: undoHistory(payload.raw) };
    } else if (editsBody(kind)) {
      contentSession = undefined;
    }
    if (kind === "layouts" && loaded) {
      layoutSession = { key, payload, draft: structuredClone(loaded), fromEditor: false, undo: undoHistory(payload.raw) };
    } else if (kind === "layouts") {
      layoutSession = undefined;
    }
  }
  const session = editsBody(kind) ? contentSession : kind === "layouts" ? layoutSession : undefined;
  const record = session?.draft ?? asRecord(payload.data);
  const rawShown = session ? rawText(session.fromEditor, session.draft, payload.raw) : payload.raw;
  let editMode: EditMode =
    mode === "compose" && !editsBody(kind) ? "fields" : mode === "arrange" && kind !== "layouts" ? "fields" : mode;
  if (record?.type === "blog-index" && editMode === "compose") editMode = "fields";
  const bodyLayout = kind === "templates" ? templateBodyLayout() : payload.layout;
  const navList = kind === "nav" && editMode === "fields" && Array.isArray(payload.data);
  const pages: PageChoice[] = navList ? await contentPages() : [];
  const navNote = "";
  const assisted = kind === "bindings" && editMode === "fields" && bindingKind(record) !== "other";
  const bindingChoices = assisted ? await loadBindingChoices() : undefined;
  const arrangeInfo = kind === "layouts" ? await loadArrangeInfo(id) : undefined;
  const layoutRoot = kind === "layouts" ? asLayoutNode(record?.root) : undefined;
  const typeEditor = kind === "types" && editMode === "fields" && !!record;
  const typeLayouts = typeEditor ? await typeLayoutChoices(typeof record.layoutId === "string" ? record.layoutId : "") : [];
  const typeIds =
    editsBody(kind) && (editMode === "compose" || editMode === "fields") ? await loadTypeIds() : undefined;
  const heroUrl =
    record?.type === "article" ? await heroPreviewUrl(stringField(record, "hero")) : undefined;
  const contentExtras = heroUrl ? { heroUrl } : undefined;
  const formInner =
    editMode === "arrange"
      ? layoutRoot && arrangeInfo
        ? arrangeMarkup(layoutRoot, arrangeInfo)
        : `<p class="w3-panel w3-pale-red" role="alert">This layout’s root could not be read. Use Raw file.</p>`
      : editMode === "raw"
      ? `<p><label for="raw-file">Raw YAML</label>
         <textarea id="raw-file" name="raw" rows="24" spellcheck="false" class="w3-input w3-border w3-margin-top editor-raw">${escapeHtml(rawShown)}</textarea></p>`
      : editMode === "compose" && record
        ? composeFormInner(kind, record, bodyLayout, typeIds, contentExtras)
      : navList
        ? `<div id="nav-editor">${renderNavList(navRows(payload.data), pages)}</div>`
        : typeEditor
          ? `<div id="type-editor">${renderTypeForm(typeDraft(record), typeLayouts)}</div>`
          : assisted && record && bindingChoices
            ? renderBindingForm(id, record, bindingChoices)
            : `${navNote}${fieldsHtml(kind, record ?? payload.data, payload.layout, typeIds, contentExtras)}`;
  const place = editPlace(kind, id, record);
  const homeId = kind === "content" ? await loadHomePageId() : "";
  const pageHost = host === "page";
  const sessionActions =
    editsBody(kind) || kind === "layouts"
      ? `<button type="button" class="w3-button w3-white" data-action="undo" title="Undo (Ctrl+Z)" disabled>Undo</button><button type="button" class="w3-button w3-white" data-action="redo" title="Redo (Ctrl+Shift+Z)" disabled>Redo</button><button type="button" class="w3-button w3-white" data-action="revert">Revert</button>`
      : "";
  const deleteAction =
    kind === "content" && id !== homeId
      ? `<button type="button" class="w3-button w3-white" data-action="delete-content">Delete</button>`
      : "";
  const actionRow = `<p class="editor-actions"><button type="submit" id="record-save"${pageHost ? ' form="record-form"' : ""} class="w3-button w3-theme">Save</button>${sessionActions}${deleteAction}</p>`;
  const saveStatus = `<p id="save-status" class="w3-text-grey" hidden></p>`;
  const editor = `${lifecycleHtml(payload)}
     ${noticePanel(notice)}
     <div class="editor-tabs" role="toolbar" aria-label="Editing mode">
       ${
         kind === "layouts"
           ? `<button type="button" class="w3-button ${editMode === "arrange" ? "w3-theme" : "w3-white"}" data-mode="arrange" aria-pressed="${editMode === "arrange"}">Arrange</button>`
           : ""
       }
       ${
         editsBody(kind) && record?.type !== "blog-index"
           ? `<button type="button" class="w3-button ${editMode === "compose" ? "w3-theme" : "w3-white"}" data-mode="compose" aria-pressed="${editMode === "compose"}">Compose</button>`
           : ""
       }
       <button type="button" class="w3-button ${editMode === "fields" ? "w3-theme" : "w3-white"}" data-mode="fields" aria-pressed="${editMode === "fields"}">Fields</button>
       <button type="button" class="w3-button ${editMode === "raw" ? "w3-theme" : "w3-white"}" data-mode="raw" aria-pressed="${editMode === "raw"}">Raw file</button>
     </div>
     <p class="w3-text-grey editor-record-note"><code>${escapeHtml(payload.file)}</code></p>
     <form id="record-form" class="w3-card w3-white w3-padding-large editor-card">
       ${formInner}
       ${pageHost ? "" : `${saveStatus}${actionRow}`}
     </form>
     ${kind === "items" ? itemToolsHtml(id) : ""}
     ${
       kind === "content" && record?.type !== "blog" && record?.type !== "blog-index"
         ? contentToolsHtml(id)
         : ""
     }
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
      `<div class="editor-toolbar">
         <div class="editor-toolbar-row">
           <a class="w3-button w3-white editor-back" href="${place.back}" aria-label="Back" title="Back (Escape)">←</a>
           <h1 class="w3-large">${escapeHtml(place.heading)}</h1>
           ${actionRow}
         </div>
         ${saveStatus}
       </div>
       ${editor}`,
      true,
      place.section,
    );
    bindChrome(root);
  }
  if (editMode === "compose" || editMode === "arrange") root.querySelector(".editor-main")?.classList.add("editor-compose");
  const form = scope.querySelector<HTMLFormElement>("#record-form");
  const checkpoint = (burstId?: string): void => {
    if (!session || !form) return;
    const yaml = snapshotYaml(form, editMode, session, kind);
    if (yaml === undefined) return;
    noteChange(session.undo, yaml, burstId);
    syncUndoButtons(scope, session.undo);
  };
  if (session && form) bindUndoKeys(form, root, user, kind, id, editMode, host);
  else {
    undoKeys?.abort();
    undoKeys = undefined;
  }
  if (form && editMode === "compose" && record) await mountPageCanvas(form, record, bodyLayout, checkpoint);
  if (form && editMode === "arrange" && layoutRoot && arrangeInfo) mountArrange(form, layoutRoot, arrangeInfo, checkpoint);
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
  if (form) {
    bindPickers(form);
    bindJsonFormat(form);
  }
  form?.addEventListener("input", (event) => {
    form.dataset.dirty = "true";
    if (!session || canvasOwnsEdit(editMode, event.target)) return;
    const burst = typingBurst(event.target);
    if (burst) checkpoint(burst);
  });
  form?.addEventListener("change", (event) => {
    form.dataset.dirty = "true";
    if (!session || canvasOwnsEdit(editMode, event.target)) return;
    checkpoint(typingBurst(event.target));
  });
  form?.addEventListener("focusout", (event) => {
    if (!session) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const text =
      target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio");
    if (text) clearBurst(session.undo);
  });
  scope.querySelector<HTMLButtonElement>("[data-action=undo]")?.addEventListener("click", () => {
    void restoreHistory(root, user, kind, id, editMode, host, "undo");
  });
  scope.querySelector<HTMLButtonElement>("[data-action=redo]")?.addEventListener("click", () => {
    void restoreHistory(root, user, kind, id, editMode, host, "redo");
  });
  scope.querySelector<HTMLButtonElement>("[data-action=revert]")?.addEventListener("click", () => {
    if (!window.confirm("Discard unsaved edits and restore the last saved file?")) return;
    contentSession = undefined;
    layoutSession = undefined;
    void bindEdit(root, user, kind, id, editMode, "", false, host);
  });
  scope.querySelector<HTMLFormElement>("#item-tools")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>("[name=item-rename-id]");
    const nextId = input?.value.trim() ?? "";
    if (!nextId || nextId === id) return;
    if (!window.confirm(`Rename ${id} to ${nextId}? References will be updated.`)) return;
    void renameItem(id, nextId)
      .then(() => {
        const next = `#/items/${encodeURIComponent(nextId)}`;
        if (window.location.hash === next) void render(root);
        else window.location.hash = next;
      })
      .catch((err: unknown) => {
        showSaveError(root, err instanceof Error ? err.message : "Could not rename that item.");
      });
  });
  scope.querySelector<HTMLFormElement>("#content-tools")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>("[name=content-rename-id]");
    const nextId = input?.value.trim() ?? "";
    if (!nextId || nextId === id) return;
    if (!window.confirm(`Rename ${id} to ${nextId}? References will be updated.`)) return;
    void renameContent(id, nextId)
      .then(() => {
        contentSession = undefined;
        const next = `#/content/${encodeURIComponent(nextId)}`;
        if (window.location.hash === next) void render(root);
        else window.location.hash = next;
      })
      .catch((err: unknown) => {
        showSaveError(root, err instanceof Error ? err.message : "Could not rename that page.");
      });
  });
  scope.querySelector<HTMLButtonElement>("[data-action=delete-item]")?.addEventListener("click", () => {
    if (!window.confirm(`Delete ${id}? This cannot be undone.`)) return;
    void deleteItem(id)
      .then(() => {
        const next = "#/records/items";
        if (window.location.hash === next) void render(root);
        else window.location.hash = next;
      })
      .catch((err: unknown) => {
        showSaveError(root, err instanceof Error ? err.message : "Could not delete that item.");
      });
  });
  scope.querySelector<HTMLButtonElement>("[data-action=delete-content]")?.addEventListener("click", () => {
    const title = typeof record?.title === "string" ? record.title.trim() : "";
    const label = title || id;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    void deleteContent(id)
      .then(() => {
        contentSession = undefined;
        const next = place.back;
        if (window.location.hash === next) void render(root);
        else window.location.hash = next;
      })
      .catch((err: unknown) => {
        showSaveError(root, err instanceof Error ? err.message : "Could not delete that page.");
      });
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = scope.querySelector<HTMLButtonElement>("#record-save");
    if (button) button.disabled = true;
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
  if (session && form) syncUndoButtons(scope, session.undo);
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
  onEdit?: (burstId?: string) => void,
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
    onEdit,
  });
}

function itemToolsHtml(id: string): string {
  return `<form id="item-tools" class="w3-card w3-white w3-padding editor-card">
    <p><label for="item-rename-id">New id <input id="item-rename-id" name="item-rename-id" class="w3-input w3-border" value="${escapeHtml(id)}" autocomplete="off" spellcheck="false" /></label></p>
    <p class="editor-actions">
      <button type="submit" class="w3-button w3-white">Rename</button>
      <button type="button" class="w3-button w3-white" data-action="delete-item">Delete</button>
    </p>
  </form>`;
}

function contentToolsHtml(id: string): string {
  return `<form id="content-tools" class="w3-card w3-white w3-padding editor-card">
    <p class="editor-rename-row">
      <label for="content-rename-id">New id</label>
      <input id="content-rename-id" name="content-rename-id" class="w3-input w3-border" value="${escapeHtml(id)}" autocomplete="off" spellcheck="false" />
      <button type="submit" class="w3-button w3-white">Rename</button>
    </p>
  </form>`;
}

function asRecord(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  return data as Record<string, unknown>;
}

async function loadHomePageId(): Promise<string> {
  try {
    const listing = await listRecords();
    const site = listing.records.find((row) => row.kind === "site");
    if (!site) return "";
    const payload = await getRecord("site", site.id);
    const data = asRecord(payload.data);
    return typeof data?.homePageId === "string" ? data.homePageId : "";
  } catch {
    return "";
  }
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
    <details>
      <summary class="w3-medium">History (${rows.length})</summary>
      ${list}
      <pre id="history-view" class="w3-code editor-history-raw" hidden></pre>
    </details>
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
  options?: { heroUrl?: string },
): string {
  if (Array.isArray(data) || !data || typeof data !== "object") {
    return renderForm(
      { fields: [{ name: "_yaml", label: Array.isArray(data) ? "Entries" : "Data", type: "yaml", rows: Array.isArray(data) ? 16 : 12 }] },
      { _yaml: data },
    );
  }
  const record = data as Record<string, unknown>;
  if (kind === "content" && record.type === "blog-index") return indexNote(record);
  if (kind === "content" && record.type === "article") {
    return `${articleMeta(record)}${renderForm(schemaFor(kind, record) ?? { fields: [] }, record)}${heroField(stringField(record, "hero"), options?.heroUrl)}${frameNote(layout)}`;
  }
  if (kind === "content" && record.type === "blog") {
    return `${blogMeta(record)}${renderForm(recordSchema(kind, record, layout, types) ?? { fields: [] }, record)}${frameNote(layout)}${zoneFields(zonesOf(record), layout)}`;
  }
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
      : kind === "items"
        ? zoneFields(zonesOf(record), undefined, true)
        : "";
  return `${renderForm({ fields: base }, record)}${zones}${extras.length ? renderForm({ fields: extras }, record) : ""}`;
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

function layoutBanner(_layout?: PageLayoutHint): string {
  return "";
}

function stringField(record: Record<string, unknown>, id: string): string {
  const fields = record.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
  const value = (fields as Record<string, unknown>)[id];
  return typeof value === "string" ? value : "";
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

function zoneFields(zones: Record<string, unknown>, layout?: PageLayoutHint, item = false): string {
  const declared = layout?.declaredZones ?? [];
  const declaredSet = new Set(declared);
  const onNames = declared.length ? declared : Object.keys(zones);
  const off = declared.length ? Object.keys(zones).filter((name) => !declaredSet.has(name)) : [];
  const onLayout = onNames.map((name) => zoneEditor(name, zones[name], false, item));
  const offLayout = off.map((name) => zoneEditor(name, zones[name], true, item));
  return `${onLayout.join("")}${
    offLayout.length
      ? `<section class="editor-off-layout">
        <h2 class="w3-medium">Off layout</h2>
        ${offLayout.join("")}
      </section>`
      : ""
  }`;
}

function zoneEditor(name: string, zone: unknown, offLayout: boolean, item = false): string {
  const label = zoneLabel(name, offLayout);
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "html" in zone) {
    return `${insertButtons(`zones.${name}.html`, "html")}${textareaField(`zones.${name}.html`, htmlZoneLabel(name, offLayout, item), String((zone as { html: unknown }).html ?? ""), htmlRows(name, item, true))}`;
  }
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "json" in zone) {
    if (item) return jsonItemField(name, (zone as { json: unknown }).json);
    return jsonZoneFields(name, (zone as { json: unknown }).json, offLayout);
  }
  if (zone === undefined) {
    return `${insertButtons(`zones.${name}.html`, "html")}${textareaField(`zones.${name}.html`, htmlZoneLabel(name, offLayout, item), "", htmlRows(name, item, false))}`;
  }
  if (zone && typeof zone === "object" && !Array.isArray(zone) && "blocks" in zone) {
    if (item) return blocksItemField(name, (zone as { blocks: unknown }).blocks);
    return `${insertButtons(`zones.${name}`, "blocks")}${yamlField(`zones.${name}`, label, zone, 8)}`;
  }
  if (item && zone && typeof zone === "object" && !Array.isArray(zone) && "component" in zone) {
    return componentItemField(name, zone as { component?: unknown; props?: unknown });
  }
  return yamlField(`zones.${name}`, label, zone, 8);
}

function syncNewItemContent(form: HTMLFormElement): void {
  const zone = form.querySelector<HTMLSelectElement>("#new-item-zone")?.value ?? "";
  const content = form.querySelector<HTMLSelectElement>("#new-item-content")?.value;
  for (const row of form.querySelectorAll<HTMLElement>("[data-item-fill]")) {
    row.hidden = !zone;
  }
  for (const row of form.querySelectorAll<HTMLElement>("[data-item-component]")) {
    row.hidden = !zone || content !== "component";
  }
}

function zoneLabel(name: string, offLayout: boolean): string {
  if (offLayout) return `Off layout: ${name}`;
  if (name === "main") return "Body";
  return `Zone: ${name}`;
}

function htmlZoneLabel(name: string, offLayout: boolean, item: boolean): string {
  if (item && !offLayout) return `${labelize(name)} HTML`;
  return zoneLabel(name, offLayout);
}

function htmlRows(name: string, item: boolean, present: boolean): number {
  if (item) return 18;
  if (name === "main" || name === "hero" || (present && name === "minutes")) return 18;
  return 6;
}

function jsonItemField(name: string, json: unknown): string {
  return jsonBox(`zones.${name}.json`, `${labelize(name)} JSON`, json, "Raw JSON. Pretty-print formats this box.");
}

function blocksItemField(name: string, blocks: unknown): string {
  return jsonBox(`zones.${name}.blocks`, `${labelize(name)} blocks`, Array.isArray(blocks) ? blocks : [], "A JSON array of blocks. Pretty-print formats this box.");
}

function componentItemField(name: string, zone: { component?: unknown; props?: unknown }): string {
  const componentName = typeof zone.component === "string" ? zone.component : "";
  return `${textField(`zones.${name}.component`, `${labelize(name)} component`, componentName)}
    ${jsonBox(`zones.${name}.props`, "Props", zone.props ?? null, "A JSON object. Leave blank when there are no props. Pretty-print formats this box.")}`;
}

function jsonBox(field: string, label: string, value: unknown, hint: string): string {
  const id = fieldId(field);
  return `<p class="editor-prop-wide"><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(field)}" data-kind="json" rows="18" spellcheck="false" class="w3-input w3-border w3-margin-top editor-body">${escapeHtml(jsonText(value))}</textarea>
    <button type="button" class="w3-button w3-small w3-white w3-margin-top" data-json-format="${escapeHtml(field)}">Pretty-print</button>
    <span data-json-error class="w3-text-red"></span>
    <span class="w3-text-grey">${escapeHtml(hint)}</span></p>`;
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
  const id = fieldId(name);
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" data-kind="${type}" class="w3-input w3-border" value="${escapeHtml(value)}" />${after}</p>`;
}

function textareaField(name: string, label: string, value: string, rows: number): string {
  const id = fieldId(name);
  const extra = rows >= 14 ? " editor-body" : "";
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" rows="${rows}" class="w3-input w3-border w3-margin-top${extra}">${escapeHtml(value)}</textarea></p>`;
}

function yamlField(name: string, label: string, value: unknown, rows: number): string {
  const id = fieldId(name);
  const text = stringifyYaml(value, { indent: 2, lineWidth: 0 }).trimEnd();
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" data-kind="yaml" rows="${rows}" spellcheck="false" class="w3-input w3-border w3-margin-top editor-yaml">${escapeHtml(text)}</textarea></p>`;
}

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function pruneEmptyHtmlZones(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = dropArticleTitleZone(data as Record<string, unknown>);
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
  const read = readFormValues(form, schemaFor(kind, original), original);
  // An item has no layout to re-declare an empty zone, so a cleared HTML box stays.
  if (kind === "items") return tidyItemRecord(read);
  return pruneEmptyHtmlZones(read);
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

function bindJsonFormat(form: HTMLFormElement): void {
  form.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-json-format]");
    if (!button) return;
    event.preventDefault();
    const box = form.querySelector<HTMLTextAreaElement>(`[name="${CSS.escape(button.dataset.jsonFormat ?? "")}"]`);
    const note = button.parentElement?.querySelector<HTMLElement>("[data-json-error]");
    if (!box) return;
    const formatted = formatJsonText(box.value);
    if (!formatted.ok) {
      if (note) note.textContent = formatted.error;
      return;
    }
    if (note) note.textContent = "";
    if (box.value === formatted.text) return;
    box.value = formatted.text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    form.dataset.dirty = "true";
  });
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
    if (button.hasAttribute("data-hero-pick")) {
      event.preventDefault();
      void pickHero(form);
    }
    if (button.hasAttribute("data-hero-clear")) {
      event.preventDefault();
      setHero(form, "");
    }
    if (button.hasAttribute("data-hero-upload")) {
      event.preventDefault();
      void uploadHero(form);
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
  src?.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function openLibraryPicker(initial: PickerMode): Promise<PickedAsset | { id: string; kind: "folder" } | undefined> {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return getLibrary().then(
    (listing) =>
      new Promise((resolve) => {
        const host = document.createElement("div");
        host.className = "editor-picker-host";
        let mode = initial;
        let openId: string | null = null;
        let notice = "";
        let busy = false;
        let done = false;
        let dialog: DialogController | undefined;
        const finish = (value: PickedAsset | { id: string; kind: "folder" } | undefined) => {
          if (done) return;
          done = true;
          host.remove();
          dialog?.destroy();
          resolve(value);
        };
        const paint = () => {
          host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card" role="dialog" aria-modal="true" aria-labelledby="library-picker-title" tabindex="-1">
            <h2 id="library-picker-title" class="w3-large">Choose from the library</h2>
            <p><button type="button" class="w3-button w3-white" data-picker-close>Close</button>
            ${openId ? `<button type="button" class="w3-button w3-white" data-picker-up>Up</button>` : ""}</p>
            ${pickerUpload(notice)}
            ${renderPicker(listing, mode, openId)}
          </div></div>`;
        };
        const fail = (message: string) => {
          if (done) return;
          notice = message;
          busy = false;
          paint();
          dialog?.focus();
        };
        const uploadFile = async (file: File) => {
          if (busy || done) return;
          busy = true;
          notice = "Adding…";
          paint();
          const body = new FormData();
          body.append("file", file);
          body.append("path", file.name);
          body.append("folderId", "uploads");
          try {
            const result = await uploadLibrary(body);
            if (done) return;
            const created = result.created[0];
            if (!created || result.skipped.length) {
              fail(result.skipped[0]?.reason ?? "Could not add that file.");
              return;
            }
            const fresh = await getLibrary();
            if (done) return;
            const asset = fresh.assets.find((item) => item.id === created.id);
            if (!asset) {
              fail("Could not add that file.");
              return;
            }
            finish(asset);
          } catch (err) {
            fail(err instanceof Error ? err.message : "Could not add that file.");
          }
        };
        host.addEventListener("submit", (event) => {
          const form = event.target;
          if (form instanceof HTMLFormElement && form.hasAttribute("data-picker-upload")) event.preventDefault();
        });
        host.addEventListener("dragover", (event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-picker-upload]")) return;
          event.preventDefault();
        });
        host.addEventListener("drop", (event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-picker-upload]")) return;
          event.preventDefault();
          if (busy || done) return;
          const files = event.dataTransfer?.files;
          if (!files || files.length !== 1) {
            fail("Only one file can be added.");
            return;
          }
          void uploadFile(files[0]);
        });
        host.addEventListener("change", (event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement) || !input.hasAttribute("data-picker-file")) return;
          if (busy || done) return;
          const files = input.files;
          if (!files || files.length !== 1) {
            if (files && files.length > 1) fail("Only one file can be added.");
            return;
          }
          void uploadFile(files[0]);
        });
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
            dialog?.focus();
            return;
          }
          if (button.dataset.openFolder) {
            openId = button.dataset.openFolder;
            paint();
            dialog?.focus();
            return;
          }
          if (button.hasAttribute("data-picker-up")) {
            openId = listing.folders.find((folder) => folder.id === openId)?.parentId ?? null;
            paint();
            dialog?.focus();
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
        dialog = activateDialog(host, {
          onCancel: () => finish(undefined),
          returnFocus,
          initialFocus: "[data-picker-close]",
          closeOnBackdrop: false,
        });
      }),
  );
}

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
  root.querySelector("[data-action=rescan]")?.addEventListener("click", () => {
    if (!window.confirm("Rescan the files on disk? Missing files will be removed from the library. New files will be added to scanned.")) {
      return;
    }
    void rescanLibrary()
      .then((result) => {
        const folderId = result.added[0]?.folderId;
        if (folderId) {
          const next = `#/library/${encodeURIComponent(folderId)}`;
          if (window.location.hash !== next) {
            history.replaceState(null, "", next);
            lastAnnouncedHash = next;
          }
        }
        return bindLibrary(root, user, folderId ?? openId, rescanNotice(result));
      })
      .catch((err) => bindLibrary(root, user, openId, err instanceof Error ? err.message : "Could not rescan the library."));
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
      slot.querySelector<HTMLButtonElement>("[data-preview-asset]")?.addEventListener("click", () => {
        openAssetPreview(root, asset.id, asset.name);
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

function openAssetPreview(root: HTMLElement, id: string, name: string): void {
  const host = document.createElement("div");
  host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop>
    <div class="editor-picker" role="dialog" aria-modal="true" aria-labelledby="asset-preview-title">
      <h2 id="asset-preview-title">${escapeHtml(name)}</h2>
      <p><img src="/api/library/assets/${encodeURIComponent(id)}/file" alt="" /></p>
      <p><button type="button" class="w3-button w3-white" data-preview-close>Close</button></p>
    </div>
  </div>`;
  root.append(host);
  const close = () => {
    dialog?.destroy();
    host.remove();
  };
  host.querySelector("[data-preview-close]")?.addEventListener("click", close);
  host.querySelector("[data-dialog-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  const dialog = activateDialog(host, { onCancel: close, closeOnBackdrop: true, initialFocus: "[data-preview-close]" });
}

function rescanNotice(result: {
  removed: { id: string }[];
  added: { id: string }[];
  skipped: { name: string }[];
}): string {
  if (!result.removed.length && !result.added.length && !result.skipped.length) {
    return "Library matches the files on disk.";
  }
  const parts: string[] = [];
  if (result.removed.length) {
    parts.push(`Removed ${result.removed.length} file${result.removed.length === 1 ? "" : "s"}.`);
  }
  if (result.added.length) {
    parts.push(`Added ${result.added.length} file${result.added.length === 1 ? "" : "s"} to scanned.`);
  }
  if (result.skipped.length) {
    parts.push(`Skipped ${result.skipped.map((item) => item.name).join(", ")}.`);
  }
  return parts.join(" ");
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

