import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import { w3 } from "@r-a-i-t-h/tessera-demo-kit";

/** Port of the classic ineffable `random_cells` site function. */
export const randomCells: ComponentFn = (ctx, props = {}) => {
  const items = Array.isArray(props.items) ? (props.items as string[]) : [];
  const n = Math.ceil(Math.random() * 5);
  const cells = Array.from({ length: n }, (_, i) => {
    const label = ctx.escapeHtml(items[i] ?? "");
    return `<h3>${label}</h3><p>This is randomly generated cell content.</p>`;
  });
  return w3.cells(
    cells,
    cells.map(() => "w3-teal w3-border w3-border-white"),
  );
};
