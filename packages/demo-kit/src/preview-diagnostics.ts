import { resolveAspect, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  analyzePageDiagnostics,
  aspectSourceLabel,
  editorUrl,
  escapeHtml,
  masterLayoutSourceLabel,
  type PageDiagnostics,
} from "@r-a-i-t-h/tessera-renderer";

const ROOT_ID = "tessera-preview-diagnostics";
const PANEL_ID = "tessera-preview-diagnostics-panel";
const TOGGLE_ID = "tessera-preview-diagnostics-toggle";
const POSITION_STORAGE_KEY = "tessera-preview-diagnostics-offset";
const DEFAULT_OFFSET = { top: 12, right: 12 };
const TOGGLE_SIZE_PX = 40;
const POSITION_MARGIN_PX = 8;
const DRAG_THRESHOLD_PX = 4;

type DiagOffset = { top: number; right: number };

/** Isolated from site body / heading fonts (w3 skin, theme classes, etc.). */
const DIAG_UI_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const DIAG_MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

/** True when the site SPA is served under the editor preview mount. */
export function isEditorPreviewHost(loc: Pick<Location, "pathname"> = location): boolean {
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  return path === "/preview" || path.endsWith("/preview");
}

function layoutSourceLabel(source: "type" | "site"): string {
  return source === "type" ? "page type" : "site default";
}

function itemSourceLabel(source: "page" | "pageLayout" | "masterLayout"): string {
  switch (source) {
    case "page":
      return "page includes";
    case "pageLayout":
      return "page layout includes";
    case "masterLayout":
      return "master layout includes";
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

function linkRow(
  label: string,
  id: string,
  href: string,
  meta?: string,
  opts: { newTab?: boolean } = {},
): string {
  const metaHtml = meta ? `<span class="tessera-preview-diag-meta">${escapeHtml(meta)}</span>` : "";
  const newTab = opts.newTab !== false;
  const target = newTab ? ` target="_blank" rel="noopener"` : "";
  return `<li><a href="${escapeHtml(href)}"${target}>${escapeHtml(label)}</a> <code>${escapeHtml(id)}</code>${metaHtml}</li>`;
}

function detailsSection(title: string, body: string, open = true): string {
  if (!body.trim()) return "";
  return `<details class="tessera-preview-diag-section" ${open ? "open" : ""}><summary>${escapeHtml(title)}</summary>${body}</details>`;
}

function pageLinkList(
  refs: PageDiagnostics["pageLinks"]["linkedTo"],
  empty: string,
): string {
  if (refs.length === 0) {
    return `<p class="tessera-preview-diag-empty">${escapeHtml(empty)}</p>`;
  }
  return `<ul class="tessera-preview-diag-list">${refs
    .map((ref) => {
      const label = ref.title ?? ref.id;
      const meta = ref.missing ? "missing" : undefined;
      return linkRow(label, ref.id, `#${ref.id}`, meta, { newTab: false });
    })
    .join("")}</ul>`;
}

function renderPanelContent(info: PageDiagnostics, document: SiteDocument): string {
  const { page, profile, master, items, bindings, blog, pageLinks } = info;

  const pageBits: string[] = [
    `<li><strong>Title</strong> ${escapeHtml(page.title)}</li>`,
    `<li><strong>Id</strong> <code>${escapeHtml(page.id)}</code> · ${linkRow("Edit", page.id, editorUrl("content", page.id)).replace(/^<li>|<\/li>$/g, "")}</li>`,
    `<li><strong>Preview</strong> <a href="${escapeHtml(page.previewHash)}">${escapeHtml(page.previewHash)}</a></li>`,
  ];
  if (page.type) pageBits.push(`<li><strong>Type</strong> <code>${escapeHtml(page.type)}</code></li>`);
  if (profile.typeId) {
    pageBits.push(
      `<li><strong>Type record</strong> ${linkRow(profile.typeId, profile.typeId, editorUrl("types", profile.typeId)).replace(/^<li>|<\/li>$/g, "")}</li>`,
    );
  }
  if (page.parentId) {
    pageBits.push(`<li><strong>Parent</strong> <code>${escapeHtml(page.parentId)}</code></li>`);
  }
  if (page.tags?.length) {
    pageBits.push(`<li><strong>Tags</strong> ${escapeHtml(page.tags.join(", "))}</li>`);
  }
  if (page.fields) {
    for (const [key, value] of Object.entries(page.fields)) {
      pageBits.push(`<li><strong>${escapeHtml(key)}</strong> ${escapeHtml(value)}</li>`);
    }
  }
  const layoutBits: string[] = [
    `<li>${linkRow("Page layout", info.pageLayoutId, editorUrl("layouts", info.pageLayoutId)).replace(/^<li>|<\/li>$/g, "")} <span class="tessera-preview-diag-meta">via ${escapeHtml(layoutSourceLabel(profile.layoutSource))}</span></li>`,
  ];
  if (info.masterLayoutId) {
    layoutBits.push(
      `<li>${linkRow("Master layout", info.masterLayoutId, editorUrl("layouts", info.masterLayoutId)).replace(/^<li>|<\/li>$/g, "")} <span class="tessera-preview-diag-meta">${escapeHtml(masterLayoutSourceLabel(master.source))}${master.fromPageId ? ` (${escapeHtml(master.fromPageId)})` : ""}</span></li>`,
    );
  } else if (master.layoutId) {
    layoutBits.push(
      `<li><span class="tessera-preview-diag-meta">Master same as page layout (${escapeHtml(masterLayoutSourceLabel(master.source))})</span></li>`,
    );
  } else {
    layoutBits.push(`<li><span class="tessera-preview-diag-meta">No separate master frame</span></li>`);
  }
  const fullPage = document.pages.find((item) => item.id === page.id);
  if (fullPage) {
    const aspect = resolveAspect(document, fullPage);
    if (aspect.aspectId) {
      const label =
        document.site.aspects?.find((item) => item.id === aspect.aspectId)?.label ?? aspect.aspectId;
      layoutBits.push(
        `<li><strong>Aspect</strong> <code>${escapeHtml(aspect.aspectId)}</code> <span class="tessera-preview-diag-meta">${escapeHtml(label)} · ${escapeHtml(aspectSourceLabel(aspect.source))}${aspect.fromPageId ? ` (${escapeHtml(aspect.fromPageId)})` : ""}</span></li>`,
      );
    }
  }

  let blogHtml = "";
  if (blog) {
    const blogLines = [
      linkRow(blog.title, blog.id, editorUrl("content", blog.id)),
      linkRow("Articles list", blog.id, editorUrl("articles", blog.id)),
    ];
    if (blog.indexPageId) {
      blogLines.push(
        linkRow(blog.indexTitle ?? "Blog index", blog.indexPageId, editorUrl("content", blog.indexPageId)),
      );
    }
    blogHtml = `<ul class="tessera-preview-diag-list">${blogLines.join("")}</ul>`;
  }

  const itemsHtml =
    items.length > 0
      ? `<ul class="tessera-preview-diag-list">${items.map((item) => linkRow(item.id, item.id, editorUrl("items", item.id), itemSourceLabel(item.source))).join("")}</ul>`
      : `<p class="tessera-preview-diag-empty">None on this page.</p>`;

  const bindingsHtml =
    bindings.length > 0
      ? `<ul class="tessera-preview-diag-list">${bindings
          .map((b) => {
            const meta = [b.component, ...b.sources].join(" · ");
            return linkRow(b.id, b.id, editorUrl("bindings", b.id), meta);
          })
          .join("")}</ul>`
      : `<p class="tessera-preview-diag-empty">None referenced on this page.</p>`;

  const pageLinksHtml = [
    `<p class="tessera-preview-diag-meta"><strong>Linked to</strong></p>`,
    pageLinkList(pageLinks.linkedTo, "None."),
    `<p class="tessera-preview-diag-meta"><strong>Linked from</strong></p>`,
    pageLinkList(pageLinks.linkedFrom, "None."),
  ].join("");

  return [
    detailsSection("Page", `<ul class="tessera-preview-diag-list">${pageBits.join("")}</ul>`),
    detailsSection("Layouts", `<ul class="tessera-preview-diag-list">${layoutBits.join("")}</ul>`),
    blog ? detailsSection("Blog", blogHtml, false) : "",
    detailsSection("Page links", pageLinksHtml),
    detailsSection("Common items", itemsHtml, false),
    detailsSection("Bindings", bindingsHtml, false),
  ].join("");
}

function ensureStyles(): void {
  if (document.getElementById("tessera-preview-diagnostics-style")) return;
  const style = document.createElement("style");
  style.id = "tessera-preview-diagnostics-style";
  style.textContent = `
#${ROOT_ID},
#${ROOT_ID} * {
  font-family: ${DIAG_UI_FONT};
}
#${ROOT_ID} {
  position: fixed;
  z-index: 100000;
  font-size: 13px;
  line-height: 1.4;
  color: #111;
  letter-spacing: normal;
  text-transform: none;
}
#${TOGGLE_ID} {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #888;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  font-size: 18px;
  line-height: 1;
  font-family: ${DIAG_UI_FONT};
}
#${TOGGLE_ID}[aria-expanded="true"] {
  background: #e8f4fc;
}
#${PANEL_ID} {
  display: none;
  position: absolute;
  top: 48px;
  right: 0;
  width: min(360px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  overflow: auto;
  background: #fff;
  border: 1px solid #888;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  padding: 8px 10px 12px;
}
#${PANEL_ID}[data-open="true"] {
  display: block;
}
#${ROOT_ID} h2 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: ${DIAG_UI_FONT};
  letter-spacing: normal;
  text-transform: none;
}
.tessera-preview-diag-section {
  margin: 6px 0;
  border-top: 1px solid #ddd;
  padding-top: 4px;
}
.tessera-preview-diag-section summary {
  cursor: pointer;
  font-weight: 600;
  padding: 2px 0;
}
.tessera-preview-diag-list {
  margin: 6px 0 0;
  padding-left: 18px;
}
.tessera-preview-diag-list li {
  margin: 4px 0;
}
#${ROOT_ID} code {
  font-family: ${DIAG_MONO_FONT};
  font-size: 12px;
}
.tessera-preview-diag-meta {
  display: block;
  font-size: 11px;
  color: #555;
  margin-top: 2px;
}
.tessera-preview-diag-empty {
  margin: 6px 0 0;
  color: #555;
  font-size: 12px;
}
.tessera-preview-diag-list a {
  color: #0563c1;
}
`;
  document.head.append(style);
}

function loadDiagOffset(): DiagOffset {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return DEFAULT_OFFSET;
    const parsed = JSON.parse(raw) as DiagOffset;
    if (typeof parsed.top === "number" && typeof parsed.right === "number") {
      return { top: parsed.top, right: parsed.right };
    }
  } catch {
    /* private mode or invalid JSON */
  }
  return DEFAULT_OFFSET;
}

function saveDiagOffset(offset: DiagOffset): void {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(offset));
  } catch {
    /* private mode or quota */
  }
}

function clampDiagOffset(offset: DiagOffset): DiagOffset {
  const maxTop = Math.max(POSITION_MARGIN_PX, window.innerHeight - TOGGLE_SIZE_PX - POSITION_MARGIN_PX);
  const maxRight = Math.max(POSITION_MARGIN_PX, window.innerWidth - TOGGLE_SIZE_PX - POSITION_MARGIN_PX);
  return {
    top: Math.min(Math.max(POSITION_MARGIN_PX, offset.top), maxTop),
    right: Math.min(Math.max(POSITION_MARGIN_PX, offset.right), maxRight),
  };
}

function applyDiagOffset(root: HTMLElement, offset: DiagOffset): void {
  root.style.top = `${offset.top}px`;
  root.style.right = `${offset.right}px`;
}

type DragSession = {
  startX: number;
  startY: number;
  startOffset: DiagOffset;
  moved: boolean;
  end: () => void;
};

function attachDiagDrag(root: HTMLElement, toggle: HTMLButtonElement, panel: HTMLElement): void {
  let offset = clampDiagOffset(loadDiagOffset());
  applyDiagOffset(root, offset);

  let session: DragSession | null = null;
  let suppressClick = false;
  /** Ignore the synthetic mouse event that follows touch/pointer on mobile Safari. */
  let ignoreMouseDownUntil = 0;

  const onResize = () => {
    offset = clampDiagOffset(offset);
    applyDiagOffset(root, offset);
  };
  window.addEventListener("resize", onResize);

  toggle.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  toggle.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      suppressClick = false;
    }
  });

  const applyMove = (clientX: number, clientY: number) => {
    if (!session) return;
    const dx = clientX - session.startX;
    const dy = clientY - session.startY;
    if (!session.moved && Math.abs(dx) <= DRAG_THRESHOLD_PX && Math.abs(dy) <= DRAG_THRESHOLD_PX) return;
    session.moved = true;
    offset = clampDiagOffset({
      top: session.startOffset.top + dy,
      right: session.startOffset.right - dx,
    });
    applyDiagOffset(root, offset);
  };

  const finishSession = () => {
    if (!session) return;
    const { moved } = session;
    session.end();
    session = null;
    toggle.style.cursor = "";
    if (moved) {
      suppressClick = true;
      saveDiagOffset(offset);
      return;
    }
    const open = panel.dataset.open !== "true";
    panel.dataset.open = open ? "true" : "false";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const beginSession = (clientX: number, clientY: number, end: () => void) => {
    if (session) session.end();
    session = {
      startX: clientX,
      startY: clientY,
      startOffset: { ...offset },
      moved: false,
      end,
    };
    toggle.style.cursor = "grabbing";
  };

  // Mouse / trackpad: Safari often skips pointermove on <button>; window mouse events work.
  toggle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (Date.now() < ignoreMouseDownUntil) return;
    event.preventDefault();
    const onMove = (moveEvent: MouseEvent) => {
      if (moveEvent.buttons === 0) {
        finishSession();
        return;
      }
      moveEvent.preventDefault();
      applyMove(moveEvent.clientX, moveEvent.clientY);
    };
    const onUp = () => finishSession();
    beginSession(event.clientX, event.clientY, () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  // Touch / pen: pointer events with capture and window fallbacks.
  toggle.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (event.button !== 0) return;
    ignoreMouseDownUntil = Date.now() + 500;
    event.preventDefault();
    const pointerId = event.pointerId;
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      applyMove(moveEvent.clientX, moveEvent.clientY);
    };
    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      finishSession();
    };
    beginSession(event.clientX, event.clientY, () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      try {
        toggle.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    });
    try {
      toggle.setPointerCapture(pointerId);
    } catch {
      /* capture optional */
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });
}

function ensureRoot(): { panel: HTMLElement; toggle: HTMLButtonElement } {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    ensureStyles();
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", "Preview diagnostics");

    const toggle = document.createElement("button");
    toggle.id = TOGGLE_ID;
    toggle.type = "button";
    toggle.title = "Preview diagnostics (drag to move)";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", PANEL_ID);
    toggle.textContent = "⎈";

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.dataset.open = "false";
    panel.innerHTML = `<h2>Preview diagnostics</h2><div id="tessera-preview-diagnostics-body"></div>`;

    root.append(toggle, panel);
    document.body.append(root);
    attachDiagDrag(root, toggle, panel);
    root.dataset.dragBound = "true";
    return { panel, toggle };
  }

  const panel = document.getElementById(PANEL_ID)!;
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement;
  if (!root.dataset.dragBound) {
    attachDiagDrag(root, toggle, panel);
    root.dataset.dragBound = "true";
  } else {
    applyDiagOffset(root, clampDiagOffset(loadDiagOffset()));
  }
  return { panel, toggle };
}

/** Mount or refresh the preview diagnostics panel for the current page. */
export function updatePreviewDiagnostics(
  pageId: string,
  siteDoc: SiteDocument,
  loc: Pick<Location, "pathname"> = location,
): void {
  if (!isEditorPreviewHost(loc)) return;
  const info = analyzePageDiagnostics(siteDoc, pageId);
  ensureRoot();
  const body = document.getElementById("tessera-preview-diagnostics-body");
  if (body) body.innerHTML = renderPanelContent(info, siteDoc);
}
