import { version as tesseraVersion } from "../../../package.json";
import type { PublicUser } from "./api.js";
import { escapeHtml } from "./dom.js";

export type EditorSection =
  | "home"
  | "records"
  | "library"
  | "backups"
  | "styles"
  | "guide"
  | "users"
  | "account";

export function editorChrome(
  user: PublicUser,
  inner: string,
  wide = false,
  section: EditorSection = "home",
): string {
  const link = (href: string, label: string, key: EditorSection) => {
    const current = section === key;
    return `<a class="w3-bar-item w3-button${current ? " w3-white" : ""}" href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
  };
  return `<header class="w3-bar w3-theme">
      ${link("#/", "Tessera editor", "home")}
      ${link("#/records", "Records", "records")}
      ${link("#/library", "Library", "library")}
      ${link("#/styles", "Styles", "styles")}
      ${link("#/backups", "Backups", "backups")}
      ${link("#/users", "Users", "users")}
      <button type="button" class="w3-bar-item w3-button" data-action="render-site">Render site</button>
      <button type="button" class="w3-bar-item w3-button" data-action="publish-site">Publish</button>
      ${link("#/guide", "Guide", "guide")}
      <button type="button" class="w3-bar-item w3-button w3-right" data-action="logout">Sign out</button>
      <a class="w3-bar-item w3-button w3-right${section === "account" ? " w3-white" : ""}" href="#/account" title="Account"${section === "account" ? ' aria-current="page"' : ""}>${escapeHtml(user.username)}</a>
    </header>
    <p id="render-status" class="editor-render-status" hidden></p>
    <p id="route-status" class="editor-sr-only" aria-live="polite"></p>
    <main class="editor-main${wide ? " editor-wide" : ""}">${inner}</main>
    ${editorFooter()}`;
}

export function announceRoute(root: ParentNode): void {
  const heading = root.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  const label = heading.textContent?.trim() || "Tessera editor";
  heading.tabIndex = -1;
  heading.focus();
  document.title = `${label} · Tessera editor`;
  const status = root.querySelector<HTMLElement>("#route-status");
  if (status) status.textContent = label;
}

export function loginView(error = "", username = ""): string {
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
