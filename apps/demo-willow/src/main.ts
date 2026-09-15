import "@r-a-i-t-h/tessera-skin-w3/w3.css";
import "./site.css";

import {
  ComponentRegistry,
  SiteRenderer,
  escapeHtml,
  expandNav,
  registerGalleryComponents,
  registerNavComponents,
} from "@r-a-i-t-h/tessera-renderer";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import {
  installChromeGlobals,
  renderNavSidebar,
  renderStaleBanner,
} from "@r-a-i-t-h/tessera-demo-kit";
import { registerSiteComponents } from "./components";

installChromeGlobals();

const registry = new ComponentRegistry();
registerSiteComponents((name, fn) => registry.define(name, fn));
registerNavComponents((name, fn) => registry.define(name, fn));
registerGalleryComponents((name, fn) => registry.define(name, fn));

function closeDrawer(): void {
  (window as unknown as { w3_close?: () => void }).w3_close?.();
}

function renderTopNav(pageId: string, doc: SiteDocument): void {
  const el = document.getElementById("topnav");
  if (!el) return;
  const links = expandNav(doc).filter((entry) => entry.topbar && entry.id);
  el.innerHTML = links
    .map((entry) => {
      const id = entry.id ?? "";
      const active = id === pageId ? " is-active" : "";
      return `<a class="wh-toplink${active}" href="#${id}">${escapeHtml(entry.title ?? id)}</a>`;
    })
    .join("");
}

function renderChrome(pageId: string, doc: SiteDocument): void {
  renderTopNav(pageId, doc);
  const nav = document.getElementById("nav_data");
  if (nav) renderNavSidebar(pageId, doc, nav);
  document.title = `${doc.pages.find((p) => p.id === pageId)?.title ?? doc.site.title} · Willow Hall`;
  closeDrawer();
  window.scrollTo(0, 0);
}

const renderer = await SiteRenderer.create({
  documentUrl: "./data/site.json",
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
