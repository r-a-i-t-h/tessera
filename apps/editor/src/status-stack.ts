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
  const row = document.createElement("div");
  row.className = `editor-render-status w3-panel ${TONE_CLASS[tone]}`;
  row.setAttribute("role", tone === "error" ? "alert" : "status");

  const body = document.createElement("div");
  body.className = "editor-render-status-body";
  if (options?.html) {
    body.innerHTML = content;
  } else {
    body.textContent = content;
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "editor-render-status-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "×";

  row.append(body, dismiss);
  host.appendChild(row);
  host.hidden = false;

  const remove = (): void => {
    row.remove();
    syncHostVisibility(host);
  };
  dismiss.addEventListener("click", remove);

  return { el: row, remove };
}
