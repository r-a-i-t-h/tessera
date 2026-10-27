import { formatDatasetUrlHtml } from "@r-a-i-t-h/tessera-model";
import { applyFrameColorStyle, cardClass } from "@r-a-i-t-h/tessera-sections";
import { WCBase } from "@r-a-i-t-h/tessera-wc-base";
import {
  datasetRowTitle,
  escapeJsonScript,
  sortRowsClient,
  type DatasetColumnAlign,
  type DatasetViewPayload,
} from "./dataset-payload.js";

function readPayload(host: HTMLElement): DatasetViewPayload | undefined {
  const script = host.querySelector('script[type="application/json"]');
  if (!script?.textContent) return undefined;
  try {
    return JSON.parse(script.textContent) as DatasetViewPayload;
  } catch {
    return undefined;
  }
}

abstract class DatasetViewElement extends WCBase {
  useShadow = false;
  #payload: DatasetViewPayload | undefined;
  #sort: { field: string; dir: "asc" | "desc" } = { field: "uid", dir: "asc" };
  rootEl = this.d({ className: "tessera-dataset-view" });

  connectedCallback(): void {
    this.#payload = readPayload(this);
    if (this.#payload) this.#sort = { ...this.#payload.sort };
    super.connectedCallback();
    this.#paint();
  }

  b() {
    return [this.rootEl];
  }

  #sortedRows(): DatasetViewPayload["rows"] {
    const payload = this.#payload;
    if (!payload) return [];
    return sortRowsClient(payload.rows, this.#sort.field, this.#sort.dir);
  }

  #setCellContent(
    el: HTMLElement,
    row: DatasetViewPayload["rows"][number],
    column: DatasetViewPayload["columns"][number],
  ): void {
    const columnId = column.id;
    const rich = row.richValues?.[columnId];
    if (rich) {
      el.innerHTML = rich;
      return;
    }
    if (column.cellFormat === "url") {
      const html = formatDatasetUrlHtml(row.values[columnId] ?? "");
      if (html) {
        el.innerHTML = html;
        return;
      }
    }
    el.textContent = row.values[columnId] ?? "";
  }

  #paintEmpty(): void {
    const text = this.#payload?.empty.trim() ?? "";
    if (!text) {
      this.rootEl.replaceChildren();
      return;
    }
    const p = this.e("p", { className: "wh-muted" });
    const em = this.e("em");
    em.textContent = text;
    p.append(em);
    this.rootEl.replaceChildren(p);
  }

  #setSort(field: string): void {
    const payload = this.#payload;
    if (!payload?.interactiveSort) return;
    const col = payload.columns.find((c) => c.id === field);
    if (!col?.sortable) return;
    if (this.#sort.field === field) {
      this.#sort = { field, dir: this.#sort.dir === "asc" ? "desc" : "asc" };
    } else {
      this.#sort = { field, dir: "asc" };
    }
    this.#paint();
  }

  #paintSortBar(): HTMLElement | null {
    const payload = this.#payload;
    if (!payload?.interactiveSort || payload.variant === "table") return null;
    const bar = this.d({ className: "tessera-dataset-sort w3-small w3-margin-bottom" });

    const fieldWrap = this.d({ className: "tessera-dataset-sort-field" });
    const fieldLabel = this.e("label");
    fieldLabel.textContent = "Sort by";
    const fieldSelect = this.e("select", { className: "w3-select w3-border" });
    for (const col of payload.columns.filter((c) => c.sortable)) {
      const opt = this.e("option", { value: col.id });
      opt.textContent = col.label;
      fieldSelect.append(opt);
    }
    fieldSelect.value = this.#sort.field;
    fieldSelect.addEventListener("change", () => {
      this.#sort = { field: fieldSelect.value, dir: this.#sort.dir };
      this.#paint();
    });
    fieldWrap.append(fieldLabel, fieldSelect);

    const dirWrap = this.d({ className: "tessera-dataset-sort-field" });
    const dirLabel = this.e("label");
    dirLabel.textContent = "Sort order";
    const dirSelect = this.e("select", { className: "w3-select w3-border" });
    for (const [value, text] of [["asc", "Ascending"], ["desc", "Descending"]] as const) {
      const opt = this.e("option", { value });
      opt.textContent = text;
      dirSelect.append(opt);
    }
    dirSelect.value = this.#sort.dir;
    dirSelect.addEventListener("change", () => {
      this.#sort = { field: this.#sort.field, dir: dirSelect.value === "desc" ? "desc" : "asc" };
      this.#paint();
    });
    dirWrap.append(dirLabel, dirSelect);

    bar.append(fieldWrap, dirWrap);
    return bar;
  }

  #columnAlign(col: DatasetViewPayload["columns"][number]): DatasetColumnAlign {
    return col.align === "center" || col.align === "right" ? col.align : "left";
  }

  #appendTableHeader(
    th: HTMLElement,
    col: DatasetViewPayload["columns"][number],
    payload: DatasetViewPayload,
  ): void {
    const align = this.#columnAlign(col);
    th.dataset.align = align;
    const active = this.#sort.field === col.id;
    const dir = this.#sort.dir;
    const inner = this.d({ className: "tessera-dataset-th-inner" });
    const label = this.e("span", { className: "tessera-dataset-sort-label" });
    label.textContent = col.label;
    const glyph = this.e("span", {
      className: `tessera-dataset-sort-glyph${active ? ` is-active is-${dir}` : " is-idle"}`,
    });
    glyph.setAttribute("aria-hidden", "true");

    if (payload.interactiveSort && col.sortable) {
      const btn = this.e("button", { type: "button", className: "tessera-dataset-sort-btn" });
      btn.setAttribute("aria-sort", active ? (dir === "asc" ? "ascending" : "descending") : "none");
      btn.append(label);
      btn.addEventListener("click", () => this.#setSort(col.id));
      inner.append(btn, glyph);
    } else {
      const title = this.d({ className: "tessera-dataset-sort-static" });
      title.append(label);
      inner.append(title, glyph);
    }
    th.append(inner);
  }

  #paintTable(): void {
    const payload = this.#payload;
    if (!payload) return;
    const rows = this.#sortedRows();
    if (!rows.length) {
      this.#paintEmpty();
      return;
    }
    const table = this.e("table", {
      className: `w3-table w3-section w3-border tessera-dataset-table${payload.compact ? " tessera-dataset-table--compact" : ""}`,
    });
    if (payload.showHeader) {
      const thead = this.e("thead", { className: "tessera-dataset-table__head" });
      const tr = this.e("tr", { className: "w3-wide" });
      for (const col of payload.columns) {
        const align = this.#columnAlign(col);
        const th = this.e("th", {
          className: `tessera-dataset-table__th tessera-dataset-align-${align}`,
        });
        this.#appendTableHeader(th, col, payload);
        tr.append(th);
      }
      thead.append(tr);
      table.append(thead);
    }
    const tbody = this.e("tbody");
    for (const row of rows) {
      const tr = this.e("tr");
      for (const col of payload.columns) {
        const align = this.#columnAlign(col);
        const td = this.e("td", { className: `tessera-dataset-align-${align}` });
        td.style.textAlign = align;
        this.#setCellContent(td, row, col);
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    this.rootEl.replaceChildren(table);
  }

  #paintCards(): void {
    const payload = this.#payload;
    if (!payload) return;
    const rows = this.#sortedRows();
    const wrap = this.d({ className: "tessera-dataset-cards" });
    const sortBar = this.#paintSortBar();
    if (sortBar) wrap.append(sortBar);
    if (!rows.length) {
      this.#paintEmpty();
      return;
    }
    const headingId = payload.headingField;
    const cardShell = `${cardClass(false)} tessera-dataset-card`;
    for (const row of rows) {
      const card = this.d({ className: cardShell });
      applyFrameColorStyle(card, payload.frameColor);
      if (headingId) {
        const h3 = this.e("h3", { className: "w3-text-theme" });
        h3.textContent = row.values[headingId]?.trim() || "—";
        card.append(h3);
      }
      const bodyCols = payload.columns.filter((col) => col.id !== headingId);
      if (bodyCols.length) {
        const body = this.d({ className: "rt-card-body" });
        const table = this.e("table", { className: "tessera-dataset-card-fields w3-table w3-small" });
        const tbody = this.e("tbody");
        for (const col of bodyCols) {
          const tr = this.e("tr");
          const labelCell = this.e("th", { scope: "row" });
          labelCell.textContent = col.label;
          const valueCell = this.e("td");
          this.#setCellContent(valueCell, row, col);
          tr.append(labelCell, valueCell);
          tbody.append(tr);
        }
        table.append(tbody);
        body.append(table);
        card.append(body);
      }
      wrap.append(card);
    }
    this.rootEl.replaceChildren(wrap);
  }

  #paintList(): void {
    const payload = this.#payload;
    if (!payload) return;
    const rows = this.#sortedRows();
    const wrap = this.d({ className: "tessera-dataset-list-wrap" });
    const sortBar = this.#paintSortBar();
    if (sortBar) wrap.append(sortBar);
    if (!rows.length) {
      this.#paintEmpty();
      return;
    }
    const ul = this.e("ul", { className: "tessera-dataset-list" });
    for (const row of rows) {
      const li = this.e("li");
      li.textContent = datasetRowTitle(row, payload);
      ul.append(li);
    }
    wrap.append(ul);
    this.rootEl.replaceChildren(wrap);
  }

  #paint(): void {
    const payload = this.#payload;
    if (!payload) {
      this.rootEl.textContent = "";
      return;
    }
    if (payload.variant === "table") this.#paintTable();
    else if (payload.variant === "cards") this.#paintCards();
    else this.#paintList();
  }
}

class TesseraDatasetTable extends DatasetViewElement {}
class TesseraDatasetCards extends DatasetViewElement {}
class TesseraDatasetList extends DatasetViewElement {}

export function mountDatasetViewMarkup(payload: DatasetViewPayload): string {
  const json = escapeJsonScript(JSON.stringify(payload));
  const tag =
    payload.variant === "table"
      ? "tessera-dataset-table"
      : payload.variant === "cards"
        ? "tessera-dataset-cards"
        : "tessera-dataset-list";
  return `<${tag} class="tessera-dataset-mount"><script type="application/json">${json}</script></${tag}>`;
}

export function registerDatasetElements(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("tessera-dataset-table")) {
    customElements.define("tessera-dataset-table", TesseraDatasetTable);
  }
  if (!customElements.get("tessera-dataset-cards")) {
    customElements.define("tessera-dataset-cards", TesseraDatasetCards);
  }
  if (!customElements.get("tessera-dataset-list")) {
    customElements.define("tessera-dataset-list", TesseraDatasetList);
  }
}

export function bootDatasetViews(root: ParentNode = document): void {
  registerDatasetElements();
  root.querySelectorAll("tessera-dataset-table, tessera-dataset-cards, tessera-dataset-list").forEach((el) => {
    if (el instanceof HTMLElement && !el.classList.contains("tessera-dataset-booted")) {
      el.classList.add("tessera-dataset-booted");
    }
  });
}
