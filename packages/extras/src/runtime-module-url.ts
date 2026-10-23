import type { RuntimeModule } from "@r-a-i-t-h/tessera-model";

const RUNTIME_MODULE_URL = /^\.\/runtime-modules\/[A-Za-z0-9][A-Za-z0-9._-]*\.(mjs|js)$/;

export function isValidRuntimeModulePublicUrl(url: string): boolean {
  return RUNTIME_MODULE_URL.test(url);
}

export function publicRuntimeModuleUrlFromCatalog(catalog: readonly RuntimeModule[], id: string): string | undefined {
  const row = catalog.find((item) => item.id === id);
  if (!row?.url || !isValidRuntimeModulePublicUrl(row.url)) return undefined;
  return row.url;
}
