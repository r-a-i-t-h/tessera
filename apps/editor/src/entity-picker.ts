import { escapeHtml } from "./dom.js";

export type PickerItem = {
  label: string;
  filterText: string;
  category?: string;
  hash?: string;
  action?: string;
};

const DEBOUNCE_MS = 120;

export type PickerListHandle = {
  renderList: () => void;
  resetFilter: () => void;
  setNeedle: (value: string) => void;
};

/** Wire filter input + listbox keyboard and mouse selection. */
export function wirePickerList(options: {
  input: HTMLInputElement;
  list: HTMLElement;
  listId: string;
  getItems: () => PickerItem[];
  onSelect: (item: PickerItem) => void;
  showCategory?: boolean;
  onEscape?: () => void;
}): PickerListHandle {
  const { input, list, listId, getItems, onSelect, showCategory = false, onEscape } = options;
  input.setAttribute("aria-controls", listId);
  let activeIndex = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let needle = "";

  const getOptions = () => list.querySelectorAll<HTMLElement>('[role="option"]');

  const setActive = (index: number) => {
    const options = getOptions();
    const next = index < 0 || index >= options.length ? -1 : index;
    activeIndex = next;
    options.forEach((opt, i) => {
      opt.setAttribute("aria-selected", i === next ? "true" : "false");
    });
    if (next >= 0) {
      const active = options[next]!;
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const renderList = () => {
    const q = needle.trim().toLowerCase();
    const items = getItems();
    const filtered = q ? items.filter((item) => item.filterText.includes(q)) : items;
    if (!filtered.length) {
      list.innerHTML = `<li class="w3-text-grey editor-entity-opener-empty" role="presentation">No matches.</li>`;
      setActive(-1);
      return;
    }
    list.innerHTML = filtered
      .map((item, i) => {
        const optId = `${listId}-opt-${i}`;
        const categoryCell = showCategory && item.category
          ? `<span class="editor-picker-category">${escapeHtml(item.category)}</span>`
          : "";
        const dataAttrs = [
          item.hash ? `data-entity-hash="${escapeHtml(item.hash)}"` : "",
          item.action ? `data-entity-action="${escapeHtml(item.action)}"` : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<li role="option" id="${escapeHtml(optId)}" aria-selected="false" ${dataAttrs}><button type="button" class="editor-entity-opener-option" tabindex="-1">${categoryCell}${escapeHtml(item.label)}</button></li>`;
      })
      .join("");
    setActive(-1);
  };

  const pickRow = (row: HTMLElement | null | undefined) => {
    if (!row) return;
    const hash = row.dataset.entityHash;
    const action = row.dataset.entityAction;
    const q = needle.trim().toLowerCase();
    const items = getItems();
    const filtered = q ? items.filter((item) => item.filterText.includes(q)) : items;
    if (hash) {
      const match = filtered.find((item) => item.hash === hash);
      if (match) onSelect(match);
      return;
    }
    if (action) {
      const match = filtered.find((item) => item.action === action);
      if (match) onSelect(match);
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      needle = input.value;
      renderList();
    }, DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const options = getOptions();
      if (!options.length || options[0]?.classList.contains("editor-entity-opener-empty")) return;
      event.preventDefault();
      if (event.key === "ArrowDown") {
        setActive(activeIndex < options.length - 1 ? activeIndex + 1 : activeIndex);
      } else if (activeIndex <= 0) {
        setActive(-1);
      } else {
        setActive(activeIndex - 1);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) {
        pickRow(getOptions()[activeIndex] ?? null);
        return;
      }
      const q = needle.trim().toLowerCase();
      const filtered = q ? getItems().filter((item) => item.filterText.includes(q)) : getItems();
      if (filtered.length === 1) onSelect(filtered[0]!);
    }
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    pickRow(target.closest<HTMLElement>("[data-entity-hash], [data-entity-action]"));
  });

  return {
    renderList,
    resetFilter: () => {
      needle = "";
      input.value = "";
      setActive(-1);
    },
    setNeedle: (value: string) => {
      needle = value;
      input.value = value;
    },
  };
}

export function pickerItemFromOpener(item: {
  label: string;
  filterText: string;
  hash: string;
}): PickerItem {
  return { label: item.label, filterText: item.filterText, hash: item.hash };
}

export function pickerItemsFromIndex(
  items: import("./editor-index-cache.js").EditorIndexItem[],
): PickerItem[] {
  return items.map((item) => ({
    label: item.label,
    filterText: item.filterText,
    category: item.category,
    hash: item.hash,
    action: item.action,
  }));
}
