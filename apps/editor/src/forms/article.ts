import { escapeHtml } from "../dom.js";

function fieldValue(record: Record<string, unknown>, id: string): string {
  const fields = record.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
  const value = (fields as Record<string, unknown>)[id];
  return typeof value === "string" ? value : "";
}

function select(name: string, label: string, current: string, options: readonly string[], required: boolean): string {
  const known = !current || options.includes(current);
  const choices = known ? options : [current, ...options];
  const blank = required ? "" : `<option value=""${!current ? " selected" : ""}>None</option>`;
  const items = choices
    .map((id) => `<option value="${escapeHtml(id)}"${id === current ? " selected" : ""}>${escapeHtml(id)}</option>`)
    .join("");
  return `<p><label for="${name}">${escapeHtml(label)}</label>
    <select id="${name}" name="${name}" class="w3-select w3-border w3-margin-top"${required ? " required" : ""}>${blank}${items}</select></p>`;
}

/** Date first, then the tenant, precis, and author. Tags stay on the shared form. */
export function articleMeta(record: Record<string, unknown>, tenants: readonly string[]): string {
  const date = fieldValue(record, "date");
  const tenant = fieldValue(record, "tenant");
  return `<fieldset class="editor-fieldset"><legend>Article</legend>
    <p><label for="fields.date">Date</label>
      <input id="fields.date" name="fields.date" type="date" class="w3-input w3-border w3-margin-top" required value="${escapeHtml(date)}" /></p>
    ${select("fields.tenant", "Tenant", tenant, tenants, true)}
    <p><label for="fields.precis">Precis</label>
      <input id="fields.precis" name="fields.precis" class="w3-input w3-border w3-margin-top" value="${escapeHtml(fieldValue(record, "precis"))}" /></p>
    <p><label for="fields.author">Author</label>
      <input id="fields.author" name="fields.author" class="w3-input w3-border w3-margin-top" value="${escapeHtml(fieldValue(record, "author"))}" /></p>
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
    <p class="w3-text-grey">An upload is stored in the articles folder, which is created the first time.</p>
  </fieldset>`;
}

export function blogMeta(record: Record<string, unknown>, tenants: readonly string[]): string {
  const pageSize = fieldValue(record, "pageSize") || "10";
  const tenant = fieldValue(record, "tenant");
  const indexId = `${String(record.id ?? "")}-index`;
  return `<fieldset class="editor-fieldset"><legend>Blog</legend>
    <p><label for="fields.pageSize">Page size</label>
      <input id="fields.pageSize" name="fields.pageSize" inputmode="numeric" class="w3-input w3-border w3-margin-top" value="${escapeHtml(pageSize)}" /></p>
    ${select("fields.tenant", "Tenant", tenant, tenants, false)}
    <p class="w3-text-grey">Leave the tenant empty for the one unscoped blog. Its menu lists each tenant. An article whose tenant has no blog uses that blog as its parent.</p>
    <p>Index: <a href="#/content/${encodeURIComponent(indexId)}">${escapeHtml(indexId)}</a></p>
  </fieldset>`;
}

export function indexNote(record: Record<string, unknown>): string {
  const parent = typeof record.parentId === "string" ? record.parentId : "";
  const link = parent ? `<p><a href="#/content/${encodeURIComponent(parent)}">Open the blog</a></p>` : "";
  return `<p>This index is created with its blog. It lists that blog by date, title, and tags. There is nothing to compose here.</p>${link}`;
}
