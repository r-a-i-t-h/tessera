import {
  createDefaultRegistry,
  SiteRenderer,
  readSiteDocumentUrl,
} from "@r-a-i-t-h/tessera-renderer";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import { applySiteChrome, insertHeadingsMenu, installChromeGlobals, renderStaleBanner } from "@r-a-i-t-h/tessera-demo-kit";
import { bootBlog, registerExtras } from "@r-a-i-t-h/tessera-extras";

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
    document.title = page ? `${page.title} · ${doc.site.title}` : doc.site.title;
    insertHeadingsMenu(document.getElementById("app") ?? document);
    bootBlog(document);
  },
});

renderer.start();
