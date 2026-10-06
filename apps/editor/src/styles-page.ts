import { siteStyleCss, type SiteStyle } from "@r-a-i-t-h/tessera-model";
import { STYLE_FIELDS, styleDraft, styleFieldValues, styleFromValues, styleGroups } from "./forms/style.js";

export function stylesPageHtml(record: Record<string, unknown>, notice = "", error = ""): string {
  const values = styleFieldValues(record);
  const fields = styleGroups()
    .map(
      (group) => `<fieldset class="style-group">
        <legend>${escapeHtml(group.group)}</legend>
        <div class="editor-props">${group.fields.map((field) => fieldHtml(field.name, field.label, field.kind, values[field.name])).join("")}</div>
      </fieldset>`,
    )
    .join("");
  return `<h1 class="w3-large">Styles</h1>
    <p class="w3-text-grey">These tokens size and colour the default frame: a <code>tessera-sidebar</code>, a <code>tessera-bar</code>, and <code>tessera-main</code>. They are saved on the site record and written into a style element after the files below, so they override <code>:root</code> in Tessera. Willow’s shell uses <code>site.css</code> and <code>wh-</code> classes, so saving here leaves the hall unchanged. Menu side moves a <code>tessera-sidebar</code>. Willow’s drawer is placed by the master layout. <a href="#/guide">Guide</a>.</p>
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
    </form>
    <h2 class="w3-large">Stylesheets</h2>
    <p class="w3-text-grey">These are the files the site loads. Shared files start as the copies shipped with Tessera. Saving one stores a copy for this site. The preview uses a save immediately. Publish to update the published site.</p>`;
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
  const wide = kind === "url" ? ` class="editor-prop-wide"` : "";
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
  return `<p${wide}><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border" type="${type}" value="${escapeHtml(value)}" /></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type StylesheetView = {
  id: string;
  label: string;
  text: string;
  overridden: boolean;
};

export function stylesheetEditors(sheets: readonly StylesheetView[], error = ""): string {
  const alert = error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : "";
  if (!sheets.length) return `${alert}<p>No stylesheets are available.</p>`;
  return alert + sheets.map(sheetEditor).join("");
}

function sheetEditor(sheet: StylesheetView): string {
  const open = sheet.id === "site" ? " open" : "";
  const own = sheet.overridden ? " This site has its own copy." : "";
  return `<details class="style-sheet"${open}>
    <summary>${escapeHtml(sheet.label)}</summary>
    <p class="w3-small w3-text-grey">${escapeHtml(sheetNote(sheet.id) + own)}</p>
    <form data-sheet="${escapeHtml(sheet.id)}">
      <p><textarea name="text" rows="18" spellcheck="false" class="w3-input w3-border editor-yaml">${escapeHtml(sheet.text)}</textarea></p>
      <p><button type="submit" class="w3-button w3-theme">Save ${escapeHtml(sheet.label)}</button></p>
    </form>
  </details>`;
}

function sheetNote(id: string): string {
  const publish = "The preview uses a save immediately. Publish to update the published site.";
  const tokens =
    "Styles tokens are written into a style element after these files, so they override :root variables in Tessera. Editing those variables here does not change the form above.";
  const shared = "This starts as the copy shipped with Tessera. Saving stores a copy for this site.";
  if (id === "site") return `This file is this site's layout. ${tokens} ${publish}`;
  if (id === "tessera") return `${shared} ${tokens} ${publish}`;
  return `${shared} ${publish}`;
}
