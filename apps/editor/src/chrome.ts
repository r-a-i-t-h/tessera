import { version as tesseraVersion } from "../../../package.json";
import { backToTopHtml } from "./back-to-top.js";
import type { PublicUser } from "./api.js";
import { isFullAdmin } from "./access.js";
import { escapeHtml } from "./dom.js";
import { ADMIN_MENU, isSidebarLinkCurrent, SETUP_MENU } from "./editor-sidebar-menu.js";

export type EditorSection =
  | "home"
  | "pages"
  | "articles"
  | "navigation"
  | "records"
  | "data"
  | "library"
  | "maintenance"
  | "backups"
  | "styles"
  | "guide"
  | "users"
  | "account";

export type EditorNavBlog = { id: string; title: string };

export type EditorNavDataset = { id: string; title: string };

export type EditorNavContext = {
  recordsKind?: string;
  /** Blog records shown under Articles (which blog’s articles to edit). */
  blogs?: EditorNavBlog[];
  /** Active blog id when viewing or editing that blog’s articles. */
  articlesBlog?: string;
  /** Datasets shown under Data for quick switching (dashboard stays at #/data). */
  datasets?: EditorNavDataset[];
  /** Active dataset id when editing data in a dataset grid. */
  activeDataset?: string;
};

export function editorChrome(
  user: PublicUser,
  inner: string,
  wide = false,
  section: EditorSection = "home",
  nav: EditorNavContext = {},
): string {
  const blogs = nav.blogs;
  const showArticlesNav = blogs === undefined || blogs.length > 0;
  const articlesOpen = section === "articles";
  const articlesBlogOn = Boolean(nav.articlesBlog);
  const datasetsOpen = section === "data";
  const datasetsChildOn = Boolean(nav.activeDataset);
  const datasetNav = nav.datasets;
  const showDataNav = datasetNav === undefined || datasetNav.length > 0;
  const admin = isFullAdmin(user);

  const sectionLink = (
    href: string,
    label: string,
    key: EditorSection,
    childOn = false,
    extraClass = "",
  ) => {
    const current = section === key;
    const aria = current && !childOn ? ' aria-current="page"' : "";
    const brand = extraClass.includes("editor-nav-brand");
    const classes = `w3-bar-item w3-button${extraClass ? ` ${extraClass}` : ""}${current && !brand ? " w3-white" : ""}`;
    return `<a class="${classes}" href="${href}"${aria}>${label}</a>`;
  };

  const childLink = (href: string, label: string, on: boolean) =>
    `<a class="w3-bar-item w3-button editor-nav-child${on ? " editor-nav-child-current" : ""}" href="${href}"${on ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`;

  const navGroupLabel = (label: string) =>
    `<p class="w3-bar-item editor-nav-group-label" role="presentation">${label}</p>`;

  const articlesChildren =
    articlesOpen && blogs && blogs.length
      ? `<div class="editor-nav-children" role="group" aria-label="Blogs">${blogs
          .map((blog) =>
            childLink(
              `#/articles/${encodeURIComponent(blog.id)}`,
              blog.title,
              nav.articlesBlog === blog.id,
            ),
          )
          .join("")}</div>`
      : "";

  const setupNav = admin
    ? `${navGroupLabel(SETUP_MENU.groupLabel)}
      <div class="editor-nav-children editor-nav-setup" role="group" aria-label="${SETUP_MENU.ariaLabel}">
        ${SETUP_MENU.items
          .map((item) => childLink(item.href, item.label, isSidebarLinkCurrent(item.whenActive, section, nav)))
          .join("")}
      </div>`
    : "";

  const adminNav = admin
    ? `${navGroupLabel(ADMIN_MENU.groupLabel)}
      <div class="editor-nav-children editor-nav-admin" role="group" aria-label="${ADMIN_MENU.ariaLabel}">
        ${ADMIN_MENU.items
          .map((item) => {
            const on = isSidebarLinkCurrent(item.whenActive, section, nav);
            return childLink(item.href, item.label, on);
          })
          .join("")}
      </div>`
    : "";

  const datasetsChildren =
    datasetsOpen && datasetNav && datasetNav.length
      ? `<div class="editor-nav-children" role="group" aria-label="Datasets">${datasetNav
          .map((dataset) =>
            childLink(
              `#/data/${encodeURIComponent(dataset.id)}`,
              dataset.title,
              nav.activeDataset === dataset.id,
            ),
          )
          .join("")}</div>`
      : "";

  return `<div class="editor-shell">
      <aside class="editor-sidebar w3-theme">
        <nav class="w3-bar-block editor-nav-block" aria-label="Editor">
          ${sectionLink("#/", "Tessera editor", "home", false, "editor-nav-brand w3-theme-d3")}
          ${sectionLink("#/navigation", "Navigation", "navigation")}
          ${sectionLink("#/pages", "Pages", "pages")}
          ${showArticlesNav ? `${sectionLink("#/articles", "Articles", "articles", articlesBlogOn)}${articlesChildren}` : ""}
          ${sectionLink("#/library", "Library", "library")}
          ${showDataNav ? `${sectionLink("#/data", "Data", "data", datasetsChildOn)}${datasetsChildren}` : ""}
          ${admin ? sectionLink("#/styles", "Styles", "styles") : ""}
          ${setupNav}
          ${adminNav}
          <button type="button" class="w3-bar-item w3-button" data-action="render-site">Render preview</button>
          <button type="button" class="w3-bar-item w3-button" data-action="publish-site">Publish site</button>
          ${sectionLink("#/guide", "Guide", "guide")}
        </nav>
        <div class="editor-nav-account w3-bar-block">
          <a class="w3-bar-item w3-button${section === "account" ? " w3-white" : ""}" href="#/account" title="Account"${section === "account" ? ' aria-current="page"' : ""}>${escapeHtml(user.username)}</a>
        </div>
        <div class="editor-sidebar-version">${editorVersionLabel()}</div>
      </aside>
      <div class="editor-body">
        <div id="editor-status-stack" class="editor-status-stack" hidden></div>
        <p id="route-status" class="editor-sr-only" aria-live="polite"></p>
        <div class="editor-scroll">
          <main class="editor-main${wide ? " editor-wide" : ""}">${inner}</main>
        </div>
        ${backToTopHtml()}
      </div>
    </div>`;
}

export function announceRoute(root: ParentNode): void {
  const heading = root.querySelector<HTMLElement>("main h1");
  const label = heading?.textContent?.trim() || "Tessera editor";
  document.title = `${label} · Tessera editor`;
  const status = root.querySelector<HTMLElement>("#route-status");
  if (status) status.textContent = label;
}

export function loginView(error = "", username = ""): string {
  return `<header class="editor-bar w3-bar w3-theme w3-large"><span class="w3-bar-item">Tessera editor</span></header>
    <div class="editor-scroll">
    <main class="editor-main"><form id="login-form" class="w3-card w3-white w3-padding-large editor-card">
      <h1 class="w3-large">Sign in</h1>
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
    </div>
    ${backToTopHtml()}
    <p class="editor-login-version">${editorVersionLabel()}</p>`;
}

function editorVersionLabel(): string {
  return `v${escapeHtml(tesseraVersion)}`;
}
