/** Phone drawer for the editor nav (max-width: 600px, W3 small). */

const PHONE_MQ = "(max-width: 600px)";
const OPEN_CLASS = "is-editor-sidebar-open";

function phoneLayout(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PHONE_MQ).matches;
}

function shell(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(".editor-shell");
}

function toggleButton(shellEl: HTMLElement): HTMLButtonElement | null {
  return shellEl.querySelector<HTMLButtonElement>('[data-action="toggle-editor-sidebar"]');
}

function overlayEl(shellEl: HTMLElement): HTMLElement | null {
  return shellEl.querySelector<HTMLElement>(".editor-sidebar-overlay");
}

function setOpen(shellEl: HTMLElement, open: boolean): void {
  shellEl.classList.toggle(OPEN_CLASS, open);
  const btn = toggleButton(shellEl);
  const overlay = overlayEl(shellEl);
  if (btn) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (overlay) {
    overlay.hidden = !open;
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
  }
}

export function closeEditorSidebar(root: ParentNode): boolean {
  if (!phoneLayout()) return false;
  const el = shell(root);
  if (!el?.classList.contains(OPEN_CLASS)) return false;
  setOpen(el, false);
  return true;
}

export function wireEditorSidebarMobile(root: ParentNode): void {
  const el = shell(root);
  if (!el) return;

  setOpen(el, false);

  const toggle = toggleButton(el);
  toggle?.addEventListener("click", () => {
    if (!phoneLayout()) return;
    const open = !el.classList.contains(OPEN_CLASS);
    setOpen(el, open);
  });

  el.querySelector('[data-action="close-editor-sidebar"]')?.addEventListener("click", () => {
    setOpen(el, false);
  });

  el.querySelector("#editor-sidebar")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('a[href^="#"]') || target.closest('[data-action="render-site"], [data-action="publish-site"]')) {
      setOpen(el, false);
    }
  });

  if (typeof window !== "undefined") {
    const mq = window.matchMedia(PHONE_MQ);
    const onChange = () => {
      if (!mq.matches) setOpen(el, false);
    };
    mq.addEventListener("change", onChange);
  }
}
