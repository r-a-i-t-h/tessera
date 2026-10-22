import type { EditorSection } from "./chrome.js";

export type EditPlace = {
  section: EditorSection;
  back: string;
  heading: string;
};

/** Where Save’s neighbour returns, and which top-level item stays current. */
export function editPlace(kind: string, id: string, record: Record<string, unknown> | undefined): EditPlace {
  if (kind === "nav") {
    return { section: "navigation", back: "#/navigation", heading: "Navigation" };
  }
  if (kind !== "content") {
    return { section: "records", back: `#/records/${encodeURIComponent(kind)}`, heading: `${kind} / ${id}` };
  }
  const heading = titleOf(record, id);
  if (record?.type === "article") {
    const parentId = typeof record.parentId === "string" ? record.parentId.trim() : "";
    return {
      section: "articles",
      back: parentId ? `#/articles/${encodeURIComponent(parentId)}` : "#/articles",
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
