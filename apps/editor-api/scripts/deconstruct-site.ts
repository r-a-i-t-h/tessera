import { readFile } from "node:fs/promises";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { repoRoot, siteLayout } from "../src/site/paths.js";
import { SiteStore } from "../src/site/store.js";
import { join } from "node:path";

const name = process.argv[2];
if (!name) {
  console.error("Usage: tsx scripts/deconstruct-site.ts <site-name>");
  process.exit(1);
}

const layout = siteLayout(join(repoRoot, "sites", name));
const doc = parseSiteDocument(JSON.parse(await readFile(layout.flattenOut, "utf8")));
const store = new SiteStore(layout.records, undefined);
await store.writeFromDocument(doc);
console.log(`Wrote YAML records to ${layout.records}`);
