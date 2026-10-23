import { fieldById, rootColumnFieldIds, type DatasetFieldKindAny } from "@r-a-i-t-h/tessera-model";
import { getDataset } from "./api.js";

export type DatasetFieldOption = {
  id: string;
  label: string;
  kind: DatasetFieldKindAny | "uid" | "added" | "modified";
  enumOptions?: readonly { value: string; label: string }[];
};

export async function datasetFieldCatalog(datasetId: string): Promise<DatasetFieldOption[]> {
  const id = datasetId.trim();
  if (!id) return [];
  try {
    const { file } = await getDataset(id);
    return rootColumnFieldIds(file.schema.fields).map((fieldId) => {
      const field = fieldById(file.schema.fields, fieldId);
      const enumOptions =
        field?.kind === "enum" && field.options?.length
          ? field.options.map((o) => ({ value: o.value, label: o.label.trim() || o.value }))
          : undefined;
      return {
        id: fieldId,
        label: field?.label?.trim() || fieldId,
        kind: field?.kind ?? "string",
        enumOptions,
      };
    });
  } catch {
    return [];
  }
}
