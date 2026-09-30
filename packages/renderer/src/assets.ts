/**
 * Keep static-site asset URLs subdirectory-safe.
 * - Leaves absolute (`https:`, `data:`, `//…`) and hash URLs alone
 * - Rewrites root-absolute `/foo` → `./foo` so hosting under a path still works
 * - Leaves already-relative URLs unchanged
 */
export function normalizeSiteAssetUrl(url: string): string {
  if (!url) return url;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|data:|#)/i.test(url)) return url;
  if (url.startsWith("/")) return `.${url}`;
  return url;
}

export function isRootAbsoluteUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/** A URL that names a file under the site folder's `media/` directory. */
export function isSiteMediaUrl(url: string): boolean {
  return /^(?:\.\/|\/)?media\//.test(url);
}

/** Rewrite `src` and `href` values that point at `media/…`. Already depth-relative `../` URLs are left alone. */
export function rewriteMediaUrls(html: string, map: (url: string) => string): string {
  return html.replace(/(\s(?:src|href)=["'])([^"']+)(["'])/gi, (full, pre: string, url: string, post: string) => {
    if (!isSiteMediaUrl(url)) return full;
    return `${pre}${map(url)}${post}`;
  });
}
