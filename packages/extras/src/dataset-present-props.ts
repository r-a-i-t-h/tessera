import {
  parseDatasetFilters,
  type DatasetQueryOptions,
} from "@r-a-i-t-h/tessera-model";

function num(props: Record<string, unknown>, key: string): number | undefined {
  return typeof props[key] === "number" && Number.isFinite(props[key]) ? (props[key] as number) : undefined;
}

function stringList(props: Record<string, unknown>, key: string): string[] | undefined {
  const v = props[key];
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((item): item is string => typeof item === "string" && item.trim() !== "");
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
    filter: parseDatasetFilters(props.filter),
  };
}
