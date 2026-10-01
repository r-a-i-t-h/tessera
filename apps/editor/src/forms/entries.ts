export type EntryQuery = {
  type: string;
  tag: string;
  title: string;
};

/** All three boxes narrow the list. An empty box does not. */
export function entryVisible(
  entry: { type?: string; tags?: string[]; title?: string },
  query: EntryQuery,
): boolean {
  const type = query.type.trim().toLowerCase();
  const tag = query.tag.trim().toLowerCase();
  const title = query.title.trim().toLowerCase();
  if (type && !(entry.type ?? "").toLowerCase().includes(type)) return false;
  if (tag && !(entry.tags ?? []).some((item) => item.toLowerCase().includes(tag))) return false;
  if (title && !(entry.title ?? "").toLowerCase().includes(title)) return false;
  return true;
}
