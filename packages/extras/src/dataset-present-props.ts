import type { DatasetFilter, DatasetQueryOptions } from "@r-a-i-t-h/tessera-model";

function num(props: Record<string, unknown>, key: string): number | undefined {
  return typeof props[key] === "number" && Number.isFinite(props[key]) ? (props[key] as number) : undefined;
}

function stringList(props: Record<string, unknown>, key: string): string[] | undefined {
  const v = props[key];
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return out.length ? out : undefined;
}

function parseFilters(raw: unknown): DatasetFilter[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: DatasetFilter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const field = typeof (item as { field?: unknown }).field === "string" ? (item as { field: string }).field : "";
    const op = (item as { op?: unknown }).op;
    if (!field || typeof op !== "string") continue;
    if (
      op !== "eq" &&
      op !== "neq" &&
      op !== "empty" &&
      op !== "notEmpty" &&
      op !== "gte" &&
      op !== "lte"
    ) {
      continue;
    }
    out.push({
      field,
      op,
      ...("value" in (item as object) ? { value: (item as { value?: unknown }).value } : {}),
    });
  }
  return out.length ? out : undefined;
}

export function queryOptionsFromProps(props: Record<string, unknown>): DatasetQueryOptions | undefined {
  const dataset = typeof props.dataset === "string" ? props.dataset.trim() : "";
  if (!dataset) return undefined;
  const sortRaw = props.sort;
  let sort: DatasetQueryOptions["sort"];
  if (sortRaw && typeof sortRaw === "object" && !Array.isArray(sortRaw)) {
    const field = typeof (sortRaw as { field?: unknown }).field === "string" ? (sortRaw as { field: string }).field : "";
    const dir = (sortRaw as { dir?: unknown }).dir;
    if (field) sort = { field, dir: dir === "desc" ? "desc" : "asc" };
  }
  return {
    dataset,
    fields: stringList(props, "fields"),
    sort,
    limit: num(props, "limit"),
    filter: parseFilters(props.filter),
  };
}
