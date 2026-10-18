/** Legacy Miller's Ark import rules; composed headings use tessera text blocks instead. */
export function stripLegacyContentHeadingRules(css: string): string {
  return css.replace(/#content\s+h[1-6]\s*\{[\s\S]*?\}\s*/g, "");
}
