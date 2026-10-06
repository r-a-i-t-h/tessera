/** Cursor offset inside the chip so the label sits down and to the right of the pointer. */
const HOTSPOT_X = 12;
const HOTSPOT_Y = 16;

/**
 * Browser drag images snapshot the source element. Palette buttons sit in a
 * sticky column, so that snapshot is often blank. A chip on document.body
 * is outside that column and follows the cursor.
 */
export function setDragGhost(dataTransfer: DataTransfer, label: string): void {
  const text = label.trim();
  if (!text || typeof dataTransfer.setDragImage !== "function") return;
  const ghost = document.createElement("div");
  ghost.className = "editor-drag-ghost";
  ghost.textContent = text;
  document.body.appendChild(ghost);
  dataTransfer.setDragImage(ghost, HOTSPOT_X, HOTSPOT_Y);
  setTimeout(() => ghost.remove(), 0);
}
