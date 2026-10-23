import { documentDatasetMap, type DatasetSnapshot, type RecordDisplayContext } from "@r-a-i-t-h/tessera-model";
import type { ComponentFn, RenderContext } from "@r-a-i-t-h/tessera-renderer";
import { buildDatasetViewPayload, escapeJsonScript } from "./dataset-payload.js";
import { formatRecordDisplayName } from "@r-a-i-t-h/tessera-model";
import { publicRuntimeModuleUrlFromCatalog } from "./runtime-module-url.js";

export type RuntimeModuleMountSpec = {
  v: 1;
  module: string;
  props: Record<string, unknown>;
  dataset?: unknown;
  bindingId?: string;
};

function snapshotsFrom(ctx: RenderContext): Record<string, DatasetSnapshot> {
  return documentDatasetMap(ctx.document);
}

function displayContext(snapshots: Record<string, DatasetSnapshot>): RecordDisplayContext {
  const ctx: RecordDisplayContext = {
    refLabel: (datasetId, uid) => {
      const snap = snapshots[datasetId];
      if (!snap) return String(uid);
      const row = snap.records.find((r) => r.uid === uid);
      if (!row) return String(uid);
      return formatRecordDisplayName(row, snap.view.displayName ?? "", snap.schema.fields, ctx);
    },
    assetLabel: (assetId) => assetId,
  };
  return ctx;
}

function resolveModuleUrl(ctx: RenderContext, moduleId: string): string | undefined {
  const catalog = ctx.document.runtimeModules ?? [];
  const url = publicRuntimeModuleUrlFromCatalog(catalog, moduleId);
  if (!url) return undefined;
  return ctx.assetUrl ? ctx.assetUrl(url) : url;
}

export function mountRuntimeModuleMarkup(
  ctx: RenderContext,
  props: Record<string, unknown>,
  bindingId?: string,
): string {
  const moduleId = typeof props.module === "string" ? props.module.trim() : "";
  if (!moduleId) return `<!-- runtime module: missing module id -->`;
  const moduleUrl = resolveModuleUrl(ctx, moduleId);
  if (!moduleUrl) return `<!-- runtime module: unknown module ${ctx.escapeHtml(moduleId)} -->`;

  const propsOut = { ...props };
  delete propsOut.module;

  let dataset: unknown;
  const datasetId = typeof props.dataset === "string" ? props.dataset.trim() : "";
  if (datasetId) {
    const snapshots = snapshotsFrom(ctx);
    const display = displayContext(snapshots);
    display.assetLabel = (id) => {
      const media = ctx.document.media.find((m) => m.id === id);
      return media?.title?.trim() || id;
    };
    const payload = buildDatasetViewPayload(ctx, props, "list", display);
    if (payload) dataset = payload;
  }

  const spec: RuntimeModuleMountSpec = {
    v: 1,
    module: moduleUrl,
    props: propsOut,
    ...(dataset ? { dataset } : {}),
    ...(bindingId ? { bindingId } : {}),
  };
  const json = escapeJsonScript(JSON.stringify(spec));
  return `<div class="tessera-runtime-module tessera-runtime-module-mount" data-module="${ctx.escapeHtml(moduleUrl)}"><script type="application/json">${json}</script></div>`;
}

export const runtimeModule: ComponentFn = (ctx, props = {}) => mountRuntimeModuleMarkup(ctx, props);
