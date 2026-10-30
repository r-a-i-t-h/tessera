import { siteLayout, resolveDataRoot } from "../src/site/paths.js";
import { runAuthoringZoneMigration } from "../src/site/migrate-authoring.js";
import { readSchemaVersion } from "../src/store/meta.js";
import { metaPath } from "../src/store/meta.js";

const dataDir = resolveDataRoot();
const layout = siteLayout(dataDir);
const before = await readSchemaVersion(metaPath(dataDir));
const migrated = await runAuthoringZoneMigration(dataDir, layout.records);
const after = await readSchemaVersion(metaPath(dataDir));
if (migrated) {
  console.log(`Migrated authoring zones in ${layout.records} (schema ${before} → ${after}).`);
} else {
  console.log(`No migration needed (schema ${after}). Item zones repaired if required.`);
}
