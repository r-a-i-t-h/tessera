/** `<meta name>` whose content is the folder-relative hashed site file. */
export const SITE_POINTER_META = "tessera-site";

/** Tiny file the open tab polls. Not fetched on first load. */
export const SITE_REVISION_FILE = "rev.json";

/** Hex characters kept from SHA-256. Long enough to name a published snapshot. */
export const SNAPSHOT_HASH_LENGTH = 20;

export type SiteRevision = {
  hash: string;
  file: string;
};

export async function hashSnapshotBody(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, SNAPSHOT_HASH_LENGTH);
}

export function snapshotFileName(hash: string): string {
  return `site.${hash}.json`;
}

export function parseSiteRevision(value: unknown): SiteRevision | null {
  if (!value || typeof value !== "object") return null;
  const hash = (value as { hash?: unknown }).hash;
  const file = (value as { file?: unknown }).file;
  if (typeof hash !== "string" || !/^[a-f0-9]+$/.test(hash)) return null;
  if (typeof file !== "string" || file !== snapshotFileName(hash)) return null;
  return { hash, file };
}

/** Hash embedded in `site.<hash>.json`, or null when the URL is the stable `site.json`. */
export function hashFromSiteUrl(documentUrl: string): string | null {
  const bare = documentUrl.split("?")[0] ?? documentUrl;
  const base = bare.slice(bare.lastIndexOf("/") + 1);
  const match = /^site\.([a-f0-9]+)\.json$/.exec(base);
  return match?.[1] ?? null;
}

/** Replace the file name in a folder-relative or absolute data URL. */
export function siblingDataUrl(documentUrl: string, fileName: string): string {
  const hashAt = documentUrl.indexOf("#");
  const withoutHash = hashAt === -1 ? documentUrl : documentUrl.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  const bare = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const slash = bare.lastIndexOf("/");
  const dir = slash === -1 ? "" : bare.slice(0, slash + 1);
  return `${dir}${fileName}`;
}

const SITE_POINTER_RE = /<meta\s+name="tessera-site"\s+content="[^"]*"\s*\/?>/;

/** Point `index.html` at the hashed site file. Inserts the meta tag when missing. */
export function stampSitePointer(html: string, href: string): string {
  const tag = `<meta name="${SITE_POINTER_META}" content="${href}" />`;
  if (SITE_POINTER_RE.test(html)) return html.replace(SITE_POINTER_RE, tag);
  if (!/<head>/i.test(html)) {
    throw new Error("index.html has no <head> to stamp with the site file");
  }
  return html.replace(/<head>/i, `<head>\n    ${tag}`);
}
