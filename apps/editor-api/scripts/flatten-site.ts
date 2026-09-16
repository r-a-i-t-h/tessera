import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SiteStore } from "../src/site/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "demo-willow");
const siteDir = process.env.TESSERA_SITE_DIR ?? join(root, "data");
const flattenOut =
  process.env.TESSERA_FLAT_OUT ?? join(root, "public", "data", "site.json");

const store = new SiteStore(siteDir, flattenOut);
const doc = await store.flatten();
if (!doc) {
  console.error(`No site.yaml in ${siteDir}`);
  process.exit(1);
}
console.log(`Flattened ${doc.pages.length} pages to ${flattenOut}`);
