import type { RecordList } from "./api.js";
import { getLibrary, publishPageIds, saveRecord, uploadLibrary, type RecordSummary } from "./api.js";
import {
  bindRichTextField,
  editingToolbar,
  htmlFromEditing,
  inlineTools,
  listTools,
  runRichTextCommand,
  type RichTextFieldOptions,
} from "./compose/rich-text-field.js";
import type { EditorNavBlog } from "./chrome.js";
import { activateDialog } from "./dialog.js";
import { escapeHtml, formErrorPanel, showEditorToast, showFormError } from "./dom.js";
import { heroField } from "./forms/article.js";
import { pageIdError, titleToRecordId } from "./forms/page.js";
import { openLibraryPicker } from "./library-picker.js";
import { editorMediaSrc } from "./forms/media-url.js";
import { PREVIEW_SITE_HREF, publishedSiteHref } from "./site-hrefs.js";
import { refreshSidebarNav } from "./sidebar-nav.js";
import { closeSchemaHelp, toggleSchemaHelp } from "./datasets/schema-form.js";
import { INFO_ICON } from "./editor-icons.js";

export type QuickBlogSiteOptions = {
  delivery: "pages" | "snapshot";
  publishTo?: string;
  origin?: string;
};

/** `inline` adds left margin when the button sits beside Open preview / Open published site. */
export function quickBlogButtonHtml(inline = false): string {
  const margin = inline ? " w3-margin-left" : "";
  return `<button type="button" class="w3-button w3-white${margin}" data-action="quick-blog">QuickBlog</button>`;
}

export function collectArticleTags(listing: RecordList): string[] {
  const tags = new Set<string>();
  for (const row of listing.records) {
    if (row.kind !== "content" || row.type !== "article") continue;
    for (const tag of row.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function topAuthorForBlog(listing: RecordList, blogId: string): string {
  const counts = new Map<string, number>();
  for (const row of listing.records) {
    if (row.kind !== "content" || row.type !== "article" || row.parentId !== blogId) continue;
    const author = row.author?.trim();
    if (!author) continue;
    counts.set(author, (counts.get(author) ?? 0) + 1);
  }
  let bestCount = 0;
  const tied: string[] = [];
  for (const [author, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      tied.length = 0;
      tied.push(author);
    } else if (count === bestCount) {
      tied.push(author);
    }
  }
  tied.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return tied[0] ?? "";
}

export function appendTagToInput(current: string, tag: string): string {
  const next = tag.trim();
  if (!next) return current;
  const parts = current
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const exists = parts.some((item) => item.localeCompare(next, undefined, { sensitivity: "base" }) === 0);
  if (exists) return current;
  return parts.length ? `${parts.join(", ")}, ${next}` : next;
}

export function bindQuickBlog(
  root: HTMLElement,
  listing: RecordList,
  blogs: EditorNavBlog[],
  site: QuickBlogSiteOptions,
): void {
  root.querySelector("[data-action=quick-blog]")?.addEventListener("click", () => {
    void openQuickBlog(listing, blogs, site);
  });
}

function existingContentIds(listing: RecordList): string[] {
  return listing.records.filter((row) => row.kind === "content").map((row) => row.id);
}

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function blogSelectHtml(blogs: EditorNavBlog[], selected: string): string {
  if (blogs.length <= 1) {
    const id = blogs[0]?.id ?? "";
    return `<input type="hidden" name="blogId" value="${escapeHtml(id)}" />`;
  }
  const options = blogs
    .map(
      (blog) =>
        `<option value="${escapeHtml(blog.id)}"${blog.id === selected ? " selected" : ""}>${escapeHtml(blog.title)}</option>`,
    )
    .join("");
  return `<p class="editor-prop-wide"><label for="quick-blog-blog">Blog</label>
    <select id="quick-blog-blog" name="blogId" class="w3-select w3-border">${options}</select></p>`;
}

function tagsFieldHtml(): string {
  return `<p class="editor-prop-wide editor-quick-blog-tags-field">
        <span class="editor-schema-enum-head">
          <label for="quick-blog-tags">Tags</label>
          <span class="editor-schema-help">
            <button type="button" class="editor-schema-help-button" data-schema-help aria-label="Tags format" aria-expanded="false" aria-controls="quick-blog-tags-help">${INFO_ICON}</button>
            <div id="quick-blog-tags-help" class="editor-schema-help-pop" role="note" hidden>
              <p>Separate tags with commas.</p>
            </div>
          </span>
        </span>
        <input id="quick-blog-tags" name="tags" class="w3-input w3-border" data-kind="csv" autocomplete="off" /></p>`;
}

function tagPickerHtml(tags: string[]): string {
  if (!tags.length) return "";
  const links = tags
    .map(
      (tag) =>
        `<button type="button" class="w3-button w3-small w3-white" data-tag-pick="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`,
    )
    .join("");
  return `<div class="editor-quick-blog-tag-cloud">
      <p class="editor-quick-blog-tag-cloud-label w3-small w3-text-grey">Existing tags</p>
      <div class="editor-quick-blog-tag-cloud-list">${links}</div>
    </div>`;
}

function liveInstallHtml(site: QuickBlogSiteOptions): string {
  if (site.delivery !== "pages" || !site.publishTo?.trim()) return "";
  return `<p class="editor-prop-wide editor-check"><label><input type="checkbox" name="installLive" checked /> Install on live site (article and blog index only; search index unchanged)</label></p>`;
}

function snapshotNote(site: QuickBlogSiteOptions): string {
  if (site.delivery !== "snapshot" || !site.publishTo?.trim()) return "";
  return `<p class="editor-prop-wide w3-small w3-text-grey">Snapshot delivery: use <strong>Publish site</strong> for the live copy. QuickBlog still updates the preview.</p>`;
}

async function openQuickBlog(listing: RecordList, blogs: EditorNavBlog[], site: QuickBlogSiteOptions): Promise<void> {
  if (!blogs.length) return;
  const defaultBlog = blogs[0]!.id;
  const tags = collectArticleTags(listing);
  const existingIds = existingContentIds(listing);
  const authorDefault = topAuthorForBlog(listing, defaultBlog);

  const host = document.createElement("div");
  host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop>
    <div class="w3-card w3-white w3-padding editor-card editor-quick-blog-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-blog-title" tabindex="-1">
      <h2 id="quick-blog-title" class="w3-large">QuickBlog</h2>
      <form id="quick-blog-form" class="editor-props editor-quick-blog-form">
        ${blogSelectHtml(blogs, defaultBlog)}
        <p class="editor-prop-wide"><label for="quick-blog-title-input">Title</label>
          <input id="quick-blog-title-input" name="title" class="w3-input w3-border" required autocomplete="off" /></p>
        <p class="editor-prop-wide w3-text-grey w3-small">Id: <span data-id-preview>—</span></p>
        <p class="editor-prop-wide"><label for="fields.author">Author</label>
          <input id="fields.author" name="fields.author" class="w3-input w3-border" value="${escapeHtml(authorDefault)}" autocomplete="off" /></p>
        <div class="editor-prop-wide"><label>Body</label>
          ${editingToolbar(inlineTools(), listTools())}
          <div class="editor-text-body tessera-text w3-border" contenteditable="true" data-quick-blog-body data-field="html" data-blocks="true" data-placeholder="Write…"></div>
        </div>
        <div class="editor-prop-wide">${heroField("", undefined)}</div>
        <p class="editor-prop-wide"><label for="fields.precis">Precis</label>
          <input id="fields.precis" name="fields.precis" class="w3-input w3-border" autocomplete="off" /></p>
        ${tagsFieldHtml()}
        <div class="editor-prop-wide editor-quick-blog-tag-cloud-wrap">${tagPickerHtml(tags)}</div>
        ${liveInstallHtml(site)}
        ${snapshotNote(site)}
        ${formErrorPanel()}
        <p class="editor-prop-wide"><button type="submit" class="w3-button w3-theme">Publish</button>
          <button type="button" class="w3-button w3-white" data-quick-blog-cancel>Cancel</button></p>
      </form>
    </div>
  </div>`;
  document.body.appendChild(host);

  const form = host.querySelector<HTMLFormElement>("#quick-blog-form");
  if (!form) {
    host.remove();
    return;
  }

  const richTextOptions: RichTextFieldOptions = {
    getContext: () => undefined,
    onDirty: () => {},
  };
  bindRichTextField(form, richTextOptions);
  bindHeroField(form);

  form.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const help = target?.closest<HTMLButtonElement>("[data-schema-help]");
    if (help && form.contains(help)) {
      event.preventDefault();
      toggleSchemaHelp(help);
      return;
    }
    if (!target?.closest(".editor-schema-help")) closeSchemaHelp(form);
    const cmd = target?.closest<HTMLElement>("[data-cmd]");
    if (cmd && form.contains(cmd)) {
      event.preventDefault();
      runRichTextCommand(form, cmd.dataset.cmd ?? "", richTextOptions);
      return;
    }
    const tag = target?.closest<HTMLElement>("[data-tag-pick]");
    if (tag && form.contains(tag)) {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>("#quick-blog-tags");
      if (input && tag.dataset.tagPick) input.value = appendTagToInput(input.value, tag.dataset.tagPick);
    }
  });

  form.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-cmd]")) event.preventDefault();
  });

  const titleInput = form.querySelector<HTMLInputElement>("#quick-blog-title-input");
  const idPreview = form.querySelector("[data-id-preview]");
  const updateIdPreview = () => {
    const title = titleInput?.value ?? "";
    const id = title.trim() ? titleToRecordId(title, existingIds) : "—";
    if (idPreview) idPreview.textContent = id;
  };
  titleInput?.addEventListener("input", updateIdPreview);

  const blogSelect = form.querySelector<HTMLSelectElement>("#quick-blog-blog");
  const authorInput = form.querySelector<HTMLInputElement>("#fields.author");
  blogSelect?.addEventListener("change", () => {
    const blogId = blogSelect.value;
    if (authorInput) authorInput.value = topAuthorForBlog(listing, blogId);
  });

  const close = () => {
    dialog?.destroy();
    host.remove();
  };

  host.querySelector("[data-quick-blog-cancel]")?.addEventListener("click", close);
  host.querySelector("[data-dialog-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });

  const dialog = activateDialog(host, {
    onCancel: close,
    closeOnBackdrop: false,
    initialFocus: "#quick-blog-title-input",
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitQuickBlog(form, listing, existingIds, site, close);
  });

  updateIdPreview();
}

function bindHeroField(form: HTMLFormElement): void {
  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-hero-pick]")) {
      event.preventDefault();
      void pickHero(form);
    }
    if (target.closest("[data-hero-clear]")) {
      event.preventDefault();
      setHero(form, "");
    }
    if (target.closest("[data-hero-upload]")) {
      event.preventDefault();
      void uploadHero(form);
    }
  });
  const fileInput = form.querySelector<HTMLInputElement>("[data-hero-file]");
  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.length) void uploadHero(form);
  });
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

function readBlogId(form: HTMLFormElement): string {
  return form.querySelector<HTMLSelectElement>("#quick-blog-blog")?.value ??
    form.querySelector<HTMLInputElement>('[name="blogId"]')?.value ??
    "";
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function submitQuickBlog(
  form: HTMLFormElement,
  listing: RecordList,
  existingIds: string[],
  site: QuickBlogSiteOptions,
  close: () => void,
): Promise<void> {
  const title = form.querySelector<HTMLInputElement>("#quick-blog-title-input")?.value.trim() ?? "";
  if (!title) {
    showFormError(form, "Enter a title.");
    return;
  }
  const id = titleToRecordId(title, existingIds);
  const idProblem = pageIdError(id, existingIds);
  if (idProblem) {
    showFormError(form, idProblem);
    return;
  }
  const blogId = readBlogId(form).trim();
  if (!blogId) {
    showFormError(form, "Choose a blog.");
    return;
  }
  const bodyEl = form.querySelector<HTMLElement>("[data-quick-blog-body]");
  const html = bodyEl ? htmlFromEditing(bodyEl.innerHTML, true) : "";
  if (!html.trim()) {
    showFormError(form, "Enter a body.");
    return;
  }

  const fields: Record<string, string> = { date: todayIsoDate() };
  const precis = form.querySelector<HTMLInputElement>('[name="fields.precis"]')?.value.trim() ?? "";
  const author = form.querySelector<HTMLInputElement>('[name="fields.author"]')?.value.trim() ?? "";
  const hero = form.querySelector<HTMLInputElement>('[name="fields.hero"]')?.value.trim() ?? "";
  if (precis) fields.precis = precis;
  if (author) fields.author = author;
  if (hero) fields.hero = hero;

  const tags = parseTags(form.querySelector<HTMLInputElement>("#quick-blog-tags")?.value ?? "");

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;

  try {
    const record: Record<string, unknown> = {
      id,
      title,
      type: "article",
      parentId: blogId,
      fields,
      zones: {
        main: {
          blocks: [{ kind: "text", heading: "", level: 2, html }],
        },
      },
    };
    if (tags.length) record.tags = tags;
    await saveRecord("content", id, record);

    const installLive =
      site.delivery === "pages" &&
      !!site.publishTo?.trim() &&
      form.querySelector<HTMLInputElement>('[name="installLive"]')?.checked === true;

    if (installLive) {
      await publishPageIds([id, `${blogId}-index`], { install: true, heroAssetId: hero || undefined });
    }

    close();
    await refreshSidebarNav();
    const live = publishedSiteHref(site.origin);
    const message = installLive
      ? `Published ${id}. Preview is updated; live HTML for this article and index was copied.`
      : `Published ${id}. Preview is updated.`;
    showEditorToast(message, { href: PREVIEW_SITE_HREF });
    if (installLive && live) showEditorToast("Open the live site.", { href: live });
  } catch (err) {
    showFormError(form, err instanceof Error ? err.message : "Could not publish that article.");
    if (submit) submit.disabled = false;
  }
}
