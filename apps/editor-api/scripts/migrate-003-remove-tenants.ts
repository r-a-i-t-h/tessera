import { migrateRemoveTenants } from "../src/migrations/remove-tenants.ts";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("Usage: migrate-003-remove-tenants <TESSERA_DATA>");
  process.exit(1);
}

await migrateRemoveTenants(dataDir);
console.log("003-remove-tenants: migrated records and stamped schema 3");
