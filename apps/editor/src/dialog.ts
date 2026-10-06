export type DialogController = {
  focus: () => void;
  destroy: () => void;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function activateDialog(
  host: HTMLElement,
  options: {
    onCancel: () => void;
    returnFocus?: HTMLElement | null;
    initialFocus?: string;
    closeOnBackdrop?: boolean;
  },
): DialogController {
  const currentDialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
  const initialDialog = currentDialog();
  if (!initialDialog) throw new Error("Dialog markup needs role=\"dialog\".");
  if (initialDialog.getAttribute("aria-modal") !== "true") {
    throw new Error("Dialog markup needs aria-modal=\"true\".");
  }

  const listeners = new AbortController();
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = currentDialog();
    if (!dialog) return;
    const focusable = focusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, { signal: listeners.signal });

  host.addEventListener("click", (event) => {
    if (!options.closeOnBackdrop) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.hasAttribute("data-dialog-backdrop")) {
      options.onCancel();
    }
  }, { signal: listeners.signal });

  const focus = () => {
    const dialog = currentDialog();
    if (!dialog) return;
    const preferred = options.initialFocus
      ? dialog.querySelector<HTMLElement>(options.initialFocus)
      : undefined;
    (preferred ?? focusableElements(dialog)[0] ?? dialog).focus();
  };
  queueMicrotask(focus);

  return {
    focus,
    destroy: () => {
      listeners.abort();
      if (options.returnFocus?.isConnected) options.returnFocus.focus();
    },
  };
}

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}
