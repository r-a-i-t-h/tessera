import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAMES, repoRoot, siteLayout } from "../src/site/paths.js";
import { writeSnapshotFiles } from "../src/site/snapshot.js";

for (const name of SITE_NAMES) {
  const layout = siteLayout(join(repoRoot, "sites", name));
  const body = await readFile(layout.publishOut, "utf8");
  const rev = await writeSnapshotFiles(layout.publishOut, body, [layout.shellIndex]);
  console.log(`sites/${name}/publish/data/site.json → ${rev.file}`);
}
