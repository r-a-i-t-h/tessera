import { migrateLibraryAddedAt } from "../src/migrations/library-added-at.ts";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("Usage: migrate-004-library-added-at <TESSERA_DATA>");
  process.exit(1);
}

await migrateLibraryAddedAt(dataDir);
console.log("004-library-added-at: backfilled addedAt and stamped schema 4");
