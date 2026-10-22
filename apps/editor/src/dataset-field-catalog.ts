import { fieldById, rootColumnFieldIds } from "@r-a-i-t-h/tessera-model";
import { getDataset } from "./api.js";

export type DatasetFieldOption = { id: string; label: string };

export async function datasetFieldCatalog(datasetId: string): Promise<DatasetFieldOption[]> {
  const id = datasetId.trim();
  if (!id) return [];
  try {
    const { file } = await getDataset(id);
    return rootColumnFieldIds(file.schema.fields).map((fieldId) => {
      const field = fieldById(file.schema.fields, fieldId);
      return { id: fieldId, label: field?.label?.trim() || fieldId };
    });
  } catch {
    return [];
  }
}
