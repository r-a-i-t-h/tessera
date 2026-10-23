import {
  bootSearch,
  createDefaultRegistry,
  SiteRenderer,
  readSiteDocumentUrl,
  syncSiteBackToTop,
} from "@r-a-i-t-h/tessera-renderer";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import {
  applyAspectClass,
  applySiteChrome,
  insertHeadingsMenu,
  installChromeGlobals,
  renderStaleBanner,
  updatePreviewDiagnostics,
} from "@r-a-i-t-h/tessera-demo-kit";
import { resolveAspect } from "@r-a-i-t-h/tessera-model";
import { bootBlog, bootDatasetViews, bootRuntimeModules, registerExtras } from "@r-a-i-t-h/tessera-extras";

installChromeGlobals();

const registry = createDefaultRegistry(registerExtras);

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
    applyAspectClass(page ? resolveAspect(doc, page).aspectId : undefined);
    document.title = page ? `${page.title} · ${doc.site.title}` : doc.site.title;
    insertHeadingsMenu(document.getElementById("app") ?? document);
    syncSiteBackToTop(doc.site.backToTop === true);
    bootBlog(document);
    bootDatasetViews(document);
    bootRuntimeModules(document);
    bootSearch(document);
    updatePreviewDiagnostics(pageId, doc);
  },
});

renderer.start();
