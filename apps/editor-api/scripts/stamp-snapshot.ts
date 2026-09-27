import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSnapshotFiles } from "../src/site/snapshot.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sites = [
  "apps/demo-pure/public/data/site.json",
  "apps/demo-ineffable/public/data/site.json",
  "apps/demo-millersark/public/data/site.json",
  "apps/demo-willow/public/data/site.json",
];

for (const relative of sites) {
  const flattenOut = join(root, relative);
  const body = await readFile(flattenOut, "utf8");
  const rev = await writeSnapshotFiles(flattenOut, body);
  console.log(`${relative} → ${rev.file}`);
}
