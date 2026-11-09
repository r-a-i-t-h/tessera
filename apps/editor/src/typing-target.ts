/** True when the event target is a field where the user is typing (shortcuts should not steal keys). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Blur the focused field when the user is typing. Returns true when focus was removed. */
export function defocusTypingTarget(): boolean {
  const active = document.activeElement;
  if (!isTypingTarget(active)) return false;
  if (active instanceof HTMLElement) {
    active.blur();
    return true;
  }
  return false;
}
