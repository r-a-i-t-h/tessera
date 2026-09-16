import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { SiteStore } from "../src/site/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "demo-willow");
const jsonPath = join(root, "public", "data", "site.json");
const siteDir = join(root, "data");

const doc = parseSiteDocument(JSON.parse(await readFile(jsonPath, "utf8")));
const store = new SiteStore(siteDir);
await store.writeFromDocument(doc);
console.log(`Wrote YAML records to ${siteDir}`);
