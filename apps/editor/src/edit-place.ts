import type { EditorSection } from "./chrome.js";

export type EditPlace = {
  section: EditorSection;
  back: string;
  heading: string;
};

/** Where Save’s neighbour returns, and which top-level item stays current. */
export function editPlace(kind: string, id: string, record: Record<string, unknown> | undefined): EditPlace {
  if (kind !== "content") {
    return { section: "records", back: `#/records/${encodeURIComponent(kind)}`, heading: `${kind} / ${id}` };
  }
  const heading = titleOf(record, id);
  if (record?.type === "article") {
    const tenant = stringField(record, "tenant");
    return {
      section: "articles",
      back: tenant ? `#/articles/${encodeURIComponent(tenant)}` : "#/articles",
      heading,
    };
  }
  if (record?.type === "blog" || record?.type === "blog-index") {
    return { section: "records", back: "#/records/blogs", heading };
  }
  return { section: "pages", back: "#/pages", heading };
}

function titleOf(record: Record<string, unknown> | undefined, id: string): string {
  const title = record?.title;
  return typeof title === "string" && title.trim() ? title.trim() : id;
}

function stringField(record: Record<string, unknown>, id: string): string {
  const fields = record.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
  const value = (fields as Record<string, unknown>)[id];
  return typeof value === "string" ? value.trim() : "";
}
