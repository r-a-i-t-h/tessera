import { REORDER_ICONS } from "./editor-icons.js";

/** Show the control after the main pane scrolls past this many pixels. */
export const BACK_TO_TOP_SHOW_PX = 120;

export function backToTopHtml(): string {
  return `<button type="button" class="editor-back-to-top" aria-label="Back to top" title="Back to top">${REORDER_ICONS.up}</button>`;
}

export function bindBackToTop(root: HTMLElement): void {
  const scroller = root.querySelector(".editor-scroll");
  const button = root.querySelector<HTMLButtonElement>(".editor-back-to-top");
  if (!(scroller instanceof HTMLElement) || !button) return;

  const update = () => {
    button.classList.toggle("editor-back-to-top--visible", scroller.scrollTop > BACK_TO_TOP_SHOW_PX);
  };

  scroller.addEventListener("scroll", update, { passive: true });
  update();

  button.addEventListener("click", () => {
    scroller.scrollTo({ top: 0, behavior: "smooth" });
  });
}
