import {
  ComponentRegistry,
  SiteRenderer,
  readSiteDocumentUrl,
  registerGalleryComponents,
  registerNavComponents,
} from "@r-a-i-t-h/tessera-renderer";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import { applySiteChrome, insertHeadingsMenu, installChromeGlobals, renderStaleBanner } from "@r-a-i-t-h/tessera-demo-kit";
import { registerExtras } from "@r-a-i-t-h/tessera-extras";

installChromeGlobals();

const registry = new ComponentRegistry();
registerNavComponents((name, fn) => registry.define(name, fn));
registerGalleryComponents((name, fn) => registry.define(name, fn));
registerExtras((name, fn) => registry.define(name, fn));

const renderer = await SiteRenderer.create({
  documentUrl: readSiteDocumentUrl(),
  registry,
  mount: "#app",
  skin: w3Skin,
  onStatusChange: (status) => {
    renderStaleBanner(status.usingCachedData);
  },
  onAfterRender: (pageId, doc) => {
    applySiteChrome(doc.site.style);
    const page = doc.pages.find((p) => p.id === pageId);
    document.title = page ? `${page.title} · ${doc.site.title}` : doc.site.title;
    insertHeadingsMenu(document.getElementById("app") ?? document);
  },
});

renderer.start();
