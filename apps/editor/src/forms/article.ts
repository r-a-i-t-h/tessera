import { BLOCK_WIDTHS } from "@r-a-i-t-h/tessera-sections";
import { escapeHtml } from "../dom.js";

function fieldValue(record: Record<string, unknown>, id: string): string {
  const fields = record.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
  const value = (fields as Record<string, unknown>)[id];
  return typeof value === "string" ? value : "";
}

/** Date, precis, and author. Tags stay on the shared form. Parent blog is set when the article is created. */
export function articleMeta(record: Record<string, unknown>): string {
  const date = fieldValue(record, "date");
  const parentId = typeof record.parentId === "string" ? record.parentId.trim() : "";
  const blogLine = parentId
    ? `<p class="w3-text-grey">Blog: <a href="#/articles/${encodeURIComponent(parentId)}">${escapeHtml(parentId)}</a></p>`
    : "";
  return `<fieldset class="editor-fieldset"><legend>Article</legend>
    ${blogLine}
    <div class="editor-props editor-props-inline">
      <p><label for="fields.date">Date</label>
        <span class="editor-prop-control"><input id="fields.date" name="fields.date" type="date" class="w3-input w3-border" required value="${escapeHtml(date)}" /></span></p>
      <p><label for="fields.precis">Precis</label>
        <span class="editor-prop-control"><input id="fields.precis" name="fields.precis" class="w3-input w3-border" value="${escapeHtml(fieldValue(record, "precis"))}" /></span></p>
      <p><label for="fields.author">Author</label>
        <span class="editor-prop-control"><input id="fields.author" name="fields.author" class="w3-input w3-border" value="${escapeHtml(fieldValue(record, "author"))}" /></span></p>
    </div>
  </fieldset>`;
}

export function heroField(heroId: string, heroUrl?: string): string {
  const preview = heroUrl
    ? `<p><img data-hero-preview src="${escapeHtml(heroUrl)}" alt="" /></p>`
    : `<p data-hero-preview hidden></p>`;
  return `<fieldset class="editor-fieldset"><legend>Hero</legend>
    <input type="hidden" name="fields.hero" value="${escapeHtml(heroId)}" />
    ${preview}
    <p class="w3-text-grey" data-hero-name>${heroId ? escapeHtml(heroId) : "No image."}</p>
    <p>
      <button type="button" class="w3-button w3-white" data-hero-pick>Choose</button>
      <button type="button" class="w3-button w3-white" data-hero-clear>Clear</button>
    </p>
    <p><label>Upload <input data-hero-file type="file" accept="image/*" /></label>
      <button type="button" class="w3-button w3-white" data-hero-upload>Upload</button></p>
  </fieldset>`;
}

export function blogMeta(record: Record<string, unknown>): string {
  const pageSize = fieldValue(record, "pageSize") || "10";
  const indexId = `${String(record.id ?? "")}-index`;
  return `<fieldset class="editor-fieldset"><legend>Blog</legend>
    <p><label for="fields.pageSize">Page size</label>
      <input id="fields.pageSize" name="fields.pageSize" inputmode="numeric" class="w3-input w3-border w3-margin-top" value="${escapeHtml(pageSize)}" /></p>
    ${heroStyleSelect(fieldValue(record, "heroStyle"))}
    ${heroWidthSelect(fieldValue(record, "heroWidth"))}
    <p class="editor-check"><label><input id="fields.showIndexInNav" name="fields.showIndexInNav" type="checkbox" data-kind="checkbox"${fieldValue(record, "showIndexInNav") === "true" ? " checked" : ""} /> Show index in the menu</label></p>
    <p>Index: <a href="#/content/${encodeURIComponent(indexId)}">${escapeHtml(indexId)}</a></p>
  </fieldset>`;
}

function heroStyleSelect(current: string): string {
  const choices = [
    ["full", "Full"],
    ["banner", "Banner"],
    ["side", "Side"],
  ] as const;
  const known = choices.some(([value]) => value === current);
  const selected = known || !current ? current || "banner" : current;
  const extra = current && !known ? [[current, current] as const] : [];
  const items = [...extra, ...choices]
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
  return `<p><label for="fields.heroStyle">Hero</label>
    <select id="fields.heroStyle" name="fields.heroStyle" class="w3-select w3-border w3-margin-top">${items}</select></p>
`;
}

function heroWidthSelect(current: string): string {
  const ids = BLOCK_WIDTHS.map((item) => item.id);
  const known = ids.includes(current as (typeof ids)[number]);
  const selected = known || !current ? current || "full" : current;
  const extra = current && !known ? [[current, current] as const] : [];
  const items = [...extra, ...BLOCK_WIDTHS.map((item) => [item.id, item.label] as const)]
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
  return `<p><label for="fields.heroWidth">Hero width</label>
    <select id="fields.heroWidth" name="fields.heroWidth" class="w3-select w3-border w3-margin-top">${items}</select>
    <span class="w3-text-grey w3-small">Full and banner heroes use this width. Side keeps the column layout with a square image.</span></p>
`;
}

export function indexNote(record: Record<string, unknown>): string {
  const parent = typeof record.parentId === "string" ? record.parentId : "";
  const link = parent ? `<p><a href="#/content/${encodeURIComponent(parent)}">Open the blog</a></p>` : "";
  return link;
}
