import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readText, writeTextAtomic } from "../store/fs.js";
import { themeFileFromShell } from "./shell-stylesheets.js";
import { isSkinOverrideName, skinOverrideFile } from "./skin-override.js";

export { themeFileFromShell };

export const MAX_STYLESHEET_BYTES = 256 * 1024;

export type StylesheetRecord = {
  id: string;
  label: string;
  text: string;
  overridden: boolean;
};

const ROLE_FILES = [
  { id: "w3", label: "W3.CSS", file: "w3.css" },
  { id: "tessera", label: "Tessera", file: "tessera.css" },
  { id: "microapps", label: "Micro-apps", file: "microapps.css" },
] as const;

export class StylesheetError extends Error {
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "StylesheetError";
    this.status = status;
  }
}

export async function listStylesheets(siteRoot: string, skinDir: string): Promise<StylesheetRecord[]> {
  const shell = await readOptional(join(siteRoot, "shell", "index.html"));
  const theme = themeFileFromShell(shell);
  const sheets: StylesheetRecord[] = [];
  sheets.push(await skinSheet(siteRoot, skinDir, "w3", "W3.CSS", "w3.css"));
  if (theme) sheets.push(await skinSheet(siteRoot, skinDir, "theme", "Theme", theme));
  for (const role of ROLE_FILES) {
    if (role.id === "w3") continue;
    sheets.push(await skinSheet(siteRoot, skinDir, role.id, role.label, role.file));
  }
  const sitePath = join(siteRoot, "shell", "site.css");
  sheets.push({
    id: "site",
    label: "Site layout",
    text: await readOptional(sitePath),
    overridden: false,
  });
  return sheets;
}

export async function saveStylesheet(siteRoot: string, skinDir: string, id: string, text: string): Promise<void> {
  if (Buffer.byteLength(text, "utf8") > MAX_STYLESHEET_BYTES) {
    throw new StylesheetError(400, "That stylesheet is larger than 256KB.");
  }
  const stored = normalizeNewlines(text);
  const withNewline = stored.endsWith("\n") ? stored : `${stored}\n`;
  if (id === "site") {
    await writeTextAtomic(join(siteRoot, "shell", "site.css"), withNewline);
    return;
  }
  const file = await skinFileFor(siteRoot, id);
  if (!file) throw new StylesheetError(404, "That stylesheet is not on this site.");
  const shellDir = join(siteRoot, "shell");
  const shared = await readOptional(join(skinDir, file));
  const override = join(shellDir, "css", file);
  if (canon(withNewline) === canon(shared)) {
    if (existsSync(override)) await unlink(override);
    return;
  }
  await writeTextAtomic(override, withNewline);
}

async function skinSheet(
  siteRoot: string,
  skinDir: string,
  id: string,
  label: string,
  file: string,
): Promise<StylesheetRecord> {
  const shellDir = join(siteRoot, "shell");
  const override = skinOverrideFile(shellDir, file);
  const text = override ? await readText(override) : await readOptional(join(skinDir, file));
  return { id, label, text, overridden: Boolean(override) };
}

async function skinFileFor(siteRoot: string, id: string): Promise<string | null> {
  const role = ROLE_FILES.find((item) => item.id === id);
  if (role) return role.file;
  if (id !== "theme") return null;
  const shell = await readOptional(join(siteRoot, "shell", "index.html"));
  const theme = themeFileFromShell(shell);
  return theme && isSkinOverrideName(theme) ? theme : null;
}

function canon(text: string): string {
  return normalizeNewlines(text).trimEnd();
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readText(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}
