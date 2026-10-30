import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import { blogArticle, blogFeed, blogIndex } from "./blog.js";
import { openDaysTable } from "./open-days.js";
import { aboutRenderer, infoCard, now, pageNav } from "./pure.js";
import { randomCells } from "./random-cells.js";
import { registerCardElement } from "./rt-card.js";
import { registerDatasetElements } from "./dataset-element.js";
import { datasetCards, datasetPlainList, datasetTable } from "./dataset-present.js";
import { runtimeModule } from "./runtime-module-present.js";

/**
 * Shared component catalogue. Every site may name these. A site does not
 * ship its own implementations.
 */
export { bootBlog } from "./blog-runtime.js";
export { bootDatasetViews, registerDatasetElements } from "./dataset-element.js";
export { bootRuntimeModules } from "./runtime-boot.js";
export type { RuntimeModuleHost, RuntimeModuleMount, RuntimeModuleMountContext } from "./runtime-host.js";

export function registerExtras(define: (name: string, fn: ComponentFn) => unknown): void {
  registerCardElement();
  define("now", now);
  define("pageNav", pageNav);
  define("aboutRenderer", aboutRenderer);
  define("infoCard", infoCard);
  define("randomCells", randomCells);
  define("openDaysTable", openDaysTable);
  define("datasetTable", datasetTable);
  define("datasetCards", datasetCards);
  define("datasetPlainList", datasetPlainList);
  define("runtimeModule", runtimeModule);
  define("blogArticle", blogArticle);
  define("blogFeed", blogFeed);
  define("blogIndex", blogIndex);
  registerDatasetElements();
}
