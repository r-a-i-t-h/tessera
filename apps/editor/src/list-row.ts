import { escapeHtml } from "./dom.js";

export type EditorNavListItemOptions = {
  href: string;
  label: string;
  /** Extra markup inside the row link (already escaped). */
  metaHtml?: string;
  liClass?: string;
  liStyle?: string;
  liAttrs?: Record<string, string>;
};

/** Navigation list row: full row is a single link (no underline on the label). */
export function editorNavListItem(options: EditorNavListItemOptions): string {
  const classes = ["editor-list-item", options.liClass].filter(Boolean).join(" ");
  const style = options.liStyle ? ` style="${options.liStyle}"` : "";
  const attrs = options.liAttrs
    ? Object.entries(options.liAttrs)
        .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
        .join("")
    : "";
  const meta = options.metaHtml ?? "";
  return `<li class="${classes}"${style}${attrs}><a class="editor-list-row" href="${escapeHtml(options.href)}"><span class="editor-list-primary">${escapeHtml(options.label)}</span>${meta}</a></li>`;
}

export type EditorRecordTableRow = {
  href: string;
  cells: string[];
};

export function editorRecordTable(
  rows: EditorRecordTableRow[],
  headers: string[],
  emptyColspan: number,
  emptyMessage = "No rows yet.",
): string {
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr class="editor-record-table-row" data-list-href="${escapeHtml(row.href)}" tabindex="0" role="link">${row.cells.join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${emptyColspan}" class="w3-text-grey">${escapeHtml(emptyMessage)}</td></tr>`;
  const head = headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("");
  return `<table class="w3-table editor-record-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Rows with `data-list-href` navigate on click; interactive controls opt out via `data-list-ignore`. */
export function bindEditorListRows(root: HTMLElement): void {
  for (const row of root.querySelectorAll<HTMLElement>("[data-list-href]")) {
    if (row.dataset.listRowBound === "1") continue;
    row.dataset.listRowBound = "1";
    const href = row.dataset.listHref;
    if (!href) continue;
    const go = () => {
      window.location.hash = href.startsWith("#") ? href : `#${href}`;
    };
    row.addEventListener("click", (event) => {
      if ((event.target as Element).closest("a[href], button, input, select, textarea, [data-list-ignore]")) return;
      go();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if ((event.target as Element).closest("input, select, textarea, button")) return;
      event.preventDefault();
      go();
    });
  }
}
