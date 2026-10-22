const MUSTACHE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Binding ids referenced as `{{id}}` or `type: component` blocks with `name`. */
export function recordUsesBinding(record: unknown, bindingId: string): boolean {
  return bindingIdsIn(record).includes(bindingId);

  function bindingIdsIn(value: unknown): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    walk(value);
    return found;

    function note(id: string): void {
      if (!id || seen.has(id)) return;
      seen.add(id);
      found.push(id);
    }

    function walk(item: unknown): void {
      if (typeof item === "string") {
        for (const match of item.matchAll(MUSTACHE)) note(match[1] ?? "");
        return;
      }
      if (Array.isArray(item)) {
        for (const entry of item) walk(entry);
        return;
      }
      if (!isRecord(item)) return;
      if (item.type === "component" && typeof item.name === "string") note(item.name);
      for (const entry of Object.values(item)) walk(entry);
    }
  }
}
