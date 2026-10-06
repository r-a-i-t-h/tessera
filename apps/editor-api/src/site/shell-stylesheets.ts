import { DEFAULT_PAGE_STYLESHEETS } from "@r-a-i-t-h/tessera-renderer";

export function parseShellStylesheetLinks(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const link = tag[0];
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(link)) continue;
    const href = link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) found.push(href);
  }
  return found;
}

export function stylesheetsFromShell(html: string | undefined): string[] {
  if (!html) return [...DEFAULT_PAGE_STYLESHEETS];
  const found = parseShellStylesheetLinks(html);
  return found.length ? found : [...DEFAULT_PAGE_STYLESHEETS];
}

/** Theme file linked from the shell, such as `w3-theme-teal.css`. */
export function themeFileFromShell(html: string): string | null {
  for (const href of parseShellStylesheetLinks(html)) {
    const name = href.split("/").pop() ?? "";
    if (/^w3-theme-[a-z0-9-]+\.css$/.test(name)) return name;
  }
  return null;
}
