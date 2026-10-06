export const UNDO_LIMIT = 10;

export type UndoHistory = {
  past: string[];
  present: string;
  future: string[];
  /** Set while edits in one control replace `present` without a new step. */
  burst: string | undefined;
};

export function undoHistory(present: string): UndoHistory {
  return { past: [], present, future: [], burst: undefined };
}

export function canUndo(history: UndoHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: UndoHistory): boolean {
  return history.future.length > 0;
}

/** Record `next` as the current document. An unchanged string is ignored. */
export function noteChange(history: UndoHistory, next: string, burstId?: string): void {
  if (next === history.present) return;
  if (burstId !== undefined && burstId === history.burst) {
    history.present = next;
    return;
  }
  history.past.push(history.present);
  if (history.past.length > UNDO_LIMIT) history.past.splice(0, history.past.length - UNDO_LIMIT);
  history.future = [];
  history.present = next;
  history.burst = burstId;
}

/** End the open text visit so the next edit in that control is a new step. */
export function clearBurst(history: UndoHistory): void {
  history.burst = undefined;
}

export function undo(history: UndoHistory): boolean {
  const previous = history.past.pop();
  if (previous === undefined) return false;
  history.future.push(history.present);
  history.present = previous;
  history.burst = undefined;
  return true;
}

export function redo(history: UndoHistory): boolean {
  const next = history.future.pop();
  if (next === undefined) return false;
  history.past.push(history.present);
  history.present = next;
  history.burst = undefined;
  return true;
}
