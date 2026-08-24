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
