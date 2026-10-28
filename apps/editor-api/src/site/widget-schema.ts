import type { Widget } from "@r-a-i-t-h/tessera-sections";
import { z } from "zod";

const paletteKinds = [
  "heading",
  "text",
  "spacer",
  "panel",
  "quote",
  "imgbox",
  "card",
  "columns",
  "insert",
  "subpages",
  "toc",
  "youtube",
  "gallery",
  "pasted",
  "html",
] as const;

/** Renderer blocks use `type`; compose widgets use `kind`. */
export function isWidgetBlocks(value: unknown): value is Widget[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  const first = value[0];
  if (!first || typeof first !== "object") return false;
  return "kind" in first && !("type" in first);
}

const widgetLeaf = z
  .object({
    kind: z.enum(paletteKinds),
  })
  .passthrough();

/** Validates compose widget trees stored under `zones.*.blocks`. */
export const WidgetBlocksSchema: z.ZodType<Widget[]> = z.lazy(() =>
  z.array(
    z.union([
      widgetLeaf,
      z.object({ kind: z.literal("panel"), tone: z.string(), sections: WidgetBlocksSchema }).passthrough(),
      z.object({ kind: z.literal("card"), sections: WidgetBlocksSchema }).passthrough(),
      z.object({
        kind: z.literal("columns"),
        layout: z.string(),
        cells: z.array(z.object({ className: z.string().optional(), sections: WidgetBlocksSchema }).passthrough()),
      }).passthrough(),
    ]),
  ),
);
