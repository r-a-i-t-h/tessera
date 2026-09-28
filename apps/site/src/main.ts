import {
  ComponentRegistry,
  SiteRenderer,
  escapeHtml,
  expandNav,
  readSiteDocumentUrl,
  registerGalleryComponents,
  registerNavComponents,
  resolvePageProfile,
} from "@r-a-i-t-h/tessera-renderer";
import type { RenderContext } from "@r-a-i-t-h/tessera-renderer";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import {
  bodySwitch,
  insertHeadingsMenu,
  installChromeGlobals,
  renderNavSidebar,
  renderStaleBanner,
} from "@r-a-i-t-h/tessera-demo-kit";
import { registerExtras } from "@r-a-i-t-h/tessera-extras";

installChromeGlobals();

const registry = new ComponentRegistry();
registerNavComponents((name, fn) => registry.define(name, fn));
registerGalleryComponents((name, fn) => registry.define(name, fn));
registerExtras((name, fn) => registry.define(name, fn));

function chromeContext(pageId: string, doc: SiteDocument): RenderContext {
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!;
  return {
    document: doc,
    page,
    profile: resolvePageProfile(doc, page),
    zones: new Map(),
    registry,
    renderBlocks: () => "",
    zoneJson: () => [],
    mediaHtml: () => "",
    escapeHtml,
  };
}

function renderSidebar(pageId: string, doc: SiteDocument): void {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const navHtml = registry.render("navCollapse", chromeContext(pageId, doc), { scope: "sidebar" });
  el.innerHTML = `${navHtml}<div class="font-switch">
    <button type="button" class="w3-button w3-tiny" data-font="0">font A</button>
    <button type="button" class="w3-button w3-tiny" data-font="1">font B</button>
    <button type="button" class="w3-button w3-tiny" data-font="2">font C</button>
    <button type="button" class="w3-button w3-tiny" data-font="3">font D</button>
  </div>`;
  el.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bodySwitch.switch("font", Number((btn as HTMLElement).dataset.font));
    });
  });
}

function renderTopNav(pageId: string, doc: SiteDocument, el: HTMLElement): void {
  const links = expandNav(doc).filter((entry) => entry.topbar && entry.id);
  el.innerHTML = links
    .map((entry) => {
      const id = entry.id ?? "";
      const active = id === pageId ? " is-active" : "";
      return `<a class="wh-toplink${active}" href="#${id}">${escapeHtml(entry.title ?? id)}</a>`;
    })
    .join("");
}

function closeDrawer(): void {
  (window as unknown as { w3_close?: () => void }).w3_close?.();
}

function renderChrome(pageId: string, doc: SiteDocument): void {
  renderSidebar(pageId, doc);
  const nav = document.getElementById("nav_data");
  if (nav) renderNavSidebar(pageId, doc, nav);
  const topnav = document.getElementById("topnav");
  if (topnav) renderTopNav(pageId, doc, topnav);
  const clock = document.getElementById("clock");
  if (clock) clock.innerHTML = registry.render("now", chromeContext(pageId, doc));
  insertHeadingsMenu(document.getElementById("app") ?? document);
  if (topnav) {
    const page = doc.pages.find((p) => p.id === pageId);
    document.title = `${page?.title ?? doc.site.title} · ${doc.site.title}`;
    closeDrawer();
    window.scrollTo(0, 0);
  }
}

const renderer = await SiteRenderer.create({
  documentUrl: readSiteDocumentUrl(),
  registry,
  mount: "#app",
  skin: w3Skin,
  onStatusChange: (status) => {
    renderStaleBanner(status.usingCachedData);
  },
  onAfterRender: (pageId, doc) => {
    renderChrome(pageId, doc);
  },
});

renderer.start();
