export type StatusTone = "progress" | "success" | "error";

const TONE_CLASS: Record<StatusTone, string> = {
  progress: "w3-pale-yellow",
  success: "w3-pale-green",
  error: "w3-pale-red",
};

export type StatusEntry = {
  el: HTMLElement;
  remove: () => void;
};

function syncHostVisibility(host: HTMLElement): void {
  host.hidden = host.children.length === 0;
}

/** Live region for render/publish progress and results; messages stack instead of replacing. */
export function statusStack(root: ParentNode): HTMLElement {
  const host = root.querySelector<HTMLElement>("#editor-status-stack");
  if (!host) {
    throw new Error("Missing #editor-status-stack");
  }
  return host;
}

export function pushStatusMessage(
  root: ParentNode,
  tone: StatusTone,
  content: string,
  options?: { html?: boolean },
): StatusEntry {
  const host = statusStack(root);
  const p = document.createElement("p");
  p.className = `editor-render-status w3-panel ${TONE_CLASS[tone]}`;
  p.setAttribute("role", tone === "error" ? "alert" : "status");
  if (options?.html) {
    p.innerHTML = content;
  } else {
    p.textContent = content;
  }
  host.appendChild(p);
  host.hidden = false;
  return {
    el: p,
    remove: () => {
      p.remove();
      syncHostVisibility(host);
    },
  };
}
