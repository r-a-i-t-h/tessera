import { resetUserPassword } from "../src/admin/reset-user-password.js";

function usage(): void {
  console.error("Usage: reset-user-password <TESSERA_DATA> <username> <new-password>");
  console.error("       TESSERA_DATA=/path reset-user-password <username> <new-password>");
}

const envData = process.env.TESSERA_DATA?.trim();
const argv = process.argv.slice(2);
let dataDir: string | undefined;
let username: string | undefined;
let password: string | undefined;

if (argv.length === 3) {
  [dataDir, username, password] = argv;
} else if (argv.length === 2 && envData) {
  dataDir = envData;
  [username, password] = argv;
} else {
  usage();
  process.exit(1);
}

try {
  const name = await resetUserPassword(dataDir!, username!, password!);
  console.log(`Password updated for ${name}. Restart the editor API to drop any live sessions.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : "Could not reset the password.");
  process.exit(1);
}
