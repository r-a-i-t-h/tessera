/** The editor is not the published site root, so `./media/` would not load there. */
export function editorMediaSrc(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("./media/")) return `/preview/${trimmed.slice(2)}`;
  return trimmed;
}

/** Rewrite published media addresses in markup that is shown, not saved. */
export function editorMediaHtml(html: string): string {
  return html.replace(/(\s(?:src|href)=)(["'])(\.\/media\/[^"']+)\2/g, (_match, attr: string, quote: string, url: string) => {
    return `${attr}${quote}${editorMediaSrc(url)}${quote}`;
  });
}
