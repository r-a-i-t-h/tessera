import { siteLayout, resolveDataRoot } from "../src/site/paths.js";
import { SiteStore } from "../src/site/store.js";

const layout = siteLayout(resolveDataRoot());
const store = new SiteStore(layout.records, layout.flattenOut, async () => 0, layout.history);
const doc = await store.flatten();
if (!doc) {
  console.error(`No site.yaml in ${layout.records}`);
  process.exit(1);
}
console.log(`Flattened ${doc.pages.length} pages to ${layout.flattenOut}`);
