import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAMES, repoRoot, siteLayout } from "../src/site/paths.js";
import { writeSnapshotFiles } from "../src/site/snapshot.js";

for (const name of SITE_NAMES) {
  const layout = siteLayout(join(repoRoot, "sites", name));
  const body = await readFile(layout.flattenOut, "utf8");
  const rev = await writeSnapshotFiles(layout.flattenOut, body);
  console.log(`sites/${name}/publish/data/site.json → ${rev.file}`);
}
