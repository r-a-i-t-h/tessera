import { SITE_POINTER_META } from "@r-a-i-t-h/tessera-model";

/** Folder-relative hashed site file declared by the shell. */
export function readSiteDocumentUrl(
  doc: { querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null } = globalThis.document,
): string {
  const content = doc
    .querySelector(`meta[name="${SITE_POINTER_META}"]`)
    ?.getAttribute("content")
    ?.trim();
  if (!content || !content.startsWith("./")) {
    throw new Error(
      `meta ${SITE_POINTER_META} must point at a folder-relative site file (./data/site.<hash>.json)`,
    );
  }
  return content;
}
