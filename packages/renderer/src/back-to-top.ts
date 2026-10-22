/** Show the control after the page scrolls past this many pixels. */
export const BACK_TO_TOP_SHOW_PX = 120;

const UP_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 10.4 8 4.4l4.8 6"/></svg>`;

export function backToTopHtml(): string {
  return `<button type="button" class="tessera-back-to-top" aria-label="Back to top" title="Back to top">${UP_ICON}</button>`;
}

export function bindBackToTop(options: {
  button: HTMLButtonElement;
  scroller?: HTMLElement | null;
}): void {
  const { button, scroller } = options;
  if (button.dataset.tesseraBackToTopBound === "1") return;
  button.dataset.tesseraBackToTopBound = "1";

  const readScrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);

  const update = () => {
    button.classList.toggle("tessera-back-to-top--visible", readScrollTop() > BACK_TO_TOP_SHOW_PX);
  };

  const target: EventTarget = scroller ?? window;
  target.addEventListener("scroll", update, { passive: true });
  update();

  button.addEventListener("click", () => {
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/** Insert or remove the published-site back-to-top control (snapshot SPA). */
export function syncSiteBackToTop(enabled: boolean): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector<HTMLButtonElement>(".tessera-back-to-top");
  if (!enabled) {
    existing?.remove();
    return;
  }
  let button = existing;
  if (!button) {
    document.body.insertAdjacentHTML("beforeend", backToTopHtml());
    button = document.querySelector<HTMLButtonElement>(".tessera-back-to-top");
  }
  if (button) bindBackToTop({ button });
}
