import { siteStyleCss, type SiteStyle } from "@r-a-i-t-h/tessera-model";
import { STYLE_FIELDS, styleDraft, styleFieldValues, styleFromValues, styleGroups } from "./forms/style.js";

export function stylesPageHtml(record: Record<string, unknown>, notice = "", error = ""): string {
  const values = styleFieldValues(record);
  const fields = styleGroups()
    .map(
      (group) => `<fieldset class="style-group">
        <legend>${escapeHtml(group.group)}</legend>
        ${group.fields.map((field) => fieldHtml(field.name, field.label, field.kind, values[field.name])).join("")}
      </fieldset>`,
    )
    .join("");
  return `<h1 class="w3-large">Styles</h1>
    <p class="w3-text-grey">These tokens size and colour the default chrome: a <code>tessera-sidebar</code>, a <code>tessera-bar</code>, and <code>tessera-main</code>. Willow’s shell uses <code>site.css</code> and <code>wh-</code> classes, so saving here leaves the hall unchanged. Menu side moves a <code>tessera-sidebar</code>. Willow’s drawer is placed by the master layout. <a href="#/guide">Guide</a>.</p>
    ${notice ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(notice)}</p>` : ""}
    ${error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : ""}
    <div id="style-specimen" class="style-specimen" data-side="${escapeHtml(values.navSide)}">
      <style id="style-specimen-css">${siteStyleCss(values, ".style-specimen")}</style>
      <div class="style-specimen-bar"><span>Site title</span><span>A B</span></div>
      <div class="style-specimen-body">
        <aside class="style-specimen-side">Home</aside>
        <div class="style-specimen-main">
          <p>Body text with a <a href="#/styles">link</a>.</p>
          <nav class="tessera-links tessera-links-cards" aria-label="Sample links">
            <div class="tessera-links-row"><a class="tessera-link-card" href="#/styles">Section</a></div>
          </nav>
        </div>
      </div>
    </div>
    <form id="style-form">
      ${fields}
      <p><button type="submit" class="w3-button w3-theme">Save styles</button></p>
    </form>`;
}

export function readStyleForm(form: HTMLFormElement): { ok: true; style: SiteStyle } | { ok: false; error: string } {
  return styleFromValues(styleValues(form));
}

export function previewStyle(form: HTMLFormElement): SiteStyle {
  return styleDraft(styleValues(form));
}

function styleValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of STYLE_FIELDS) {
    const input = form.elements.namedItem(field.name);
    values[field.name] = input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? input.value : "";
  }
  return values;
}

export function paintSpecimen(root: ParentNode, style: SiteStyle): void {
  const specimen = root.querySelector<HTMLElement>("#style-specimen");
  const css = root.querySelector<HTMLStyleElement>("#style-specimen-css");
  if (!specimen || !css) return;
  css.textContent = siteStyleCss(style, ".style-specimen");
  specimen.dataset.side = style.navSide === "left" ? "left" : "right";
}

function fieldHtml(name: string, label: string, kind: string, value: string): string {
  const id = `style-${name}`;
  if (kind === "side") {
    return `<p><label for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border">
        <option value="right"${value === "right" ? " selected" : ""}>Right</option>
        <option value="left"${value === "left" ? " selected" : ""}>Left</option>
      </select></p>`;
  }
  if (kind === "color") {
    return `<p><label for="${id}">${escapeHtml(label)}</label>
      <input id="${id}" name="${escapeHtml(name)}" class="style-color" type="color" value="${escapeHtml(value)}" /></p>`;
  }
  const type = kind === "url" ? "url" : "text";
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border" type="${type}" value="${escapeHtml(value)}" /></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
