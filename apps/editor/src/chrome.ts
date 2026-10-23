import { version as tesseraVersion } from "../../../package.json";
import { backToTopHtml } from "./back-to-top.js";
import type { PublicUser } from "./api.js";
import { isFullAdmin } from "./access.js";
import { escapeHtml } from "./dom.js";
import { MAINTENANCE_TABS } from "./maintenance.js";
import { RECORD_NAV_ITEMS } from "./record-nav.js";

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
  maintenanceTab?: string;
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
  const blogs = nav.blogs ?? [];
  const articlesOpen = section === "articles";
  const articlesBlogOn = Boolean(nav.articlesBlog);
  const datasetsOpen = section === "data";
  const datasetsChildOn = Boolean(nav.activeDataset);
  const datasetNav = nav.datasets ?? [];
  const maintenanceOpen = section === "maintenance";
  const maintenanceChildOn = maintenanceOpen && Boolean(nav.maintenanceTab);
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
    articlesOpen && blogs.length
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
    ? `${navGroupLabel("Setup")}
      <div class="editor-nav-children editor-nav-setup" role="group" aria-label="Setup">
        ${RECORD_NAV_ITEMS.map((item) =>
          childLink(
            `#/records/${encodeURIComponent(item.kind)}`,
            item.label,
            nav.recordsKind === item.kind,
          ),
        ).join("")}
      </div>`
    : "";

  const maintenanceChildren = maintenanceOpen
    ? `<div class="editor-nav-children editor-nav-children-nested" role="group" aria-label="Maintenance reports">${MAINTENANCE_TABS.map((tab) =>
        childLink(
          `#/maintenance/${encodeURIComponent(tab.id)}`,
          tab.label,
          nav.maintenanceTab === tab.id,
        ),
      ).join("")}</div>`
    : "";

  const adminNav = admin
    ? `${navGroupLabel("Admin")}
      <div class="editor-nav-children editor-nav-admin" role="group" aria-label="Admin">
        ${childLink("#/users", "Users", section === "users" || section === "user")}
        ${childLink("#/maintenance", "Maintenance", section === "maintenance" && !maintenanceChildOn)}
        ${maintenanceChildren}
        ${childLink("#/backups", "Backups", section === "backups")}
      </div>`
    : "";

  const datasetsChildren =
    datasetsOpen && datasetNav.length
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
          ${sectionLink("#/articles", "Articles", "articles", articlesBlogOn)}
          ${articlesChildren}
          ${sectionLink("#/library", "Library", "library")}
          ${sectionLink("#/data", "Data", "data", datasetsChildOn)}
          ${datasetsChildren}
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
