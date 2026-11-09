export const PREVIEW_SITE_HREF = "/preview/";

/** Live `origin` URL from the site record, when set. */
export function publishedSiteHref(origin: string | undefined): string | undefined {
  const trimmed = origin?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/?$/, "/");
}
