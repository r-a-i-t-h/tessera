/** Replace one library folder id everywhere it appears in authored JSON-like trees. */
export function rewriteLibraryFolderRefs(value: unknown, from: string, to: string): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = rewriteLibraryFolderRefs(item, from, to);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, changed };
  }
  if (!value || typeof value !== "object") return { value, changed: false };

  const obj = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const result = rewriteLibraryFolderRefs(val, from, to);
    next[key] = result.value;
    if (result.changed) changed = true;
  }

  if (next.kind === "gallery" && next.folder === from) {
    next.folder = to;
    changed = true;
  }

  if (next.component === "gallery") {
    const props = next.props;
    if (props && typeof props === "object" && !Array.isArray(props)) {
      const copy = { ...(props as Record<string, unknown>) };
      let propsChanged = false;
      if (copy.folder === from) {
        copy.folder = to;
        propsChanged = true;
      }
      if (Array.isArray(copy.folders)) {
        const folders = copy.folders.map((entry) => (entry === from ? to : entry));
        if (folders.some((entry, index) => entry !== copy.folders![index])) {
          copy.folders = folders;
          propsChanged = true;
        }
      }
      if (propsChanged) {
        next.props = copy;
        changed = true;
      }
    }
  }

  return { value: changed ? next : value, changed };
}
