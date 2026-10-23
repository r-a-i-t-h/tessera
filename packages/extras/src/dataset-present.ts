import {
  documentDatasetMap,
  formatRecordDisplayName,
  type DatasetSnapshot,
  type RecordDisplayContext,
} from "@r-a-i-t-h/tessera-model";
import type { ComponentFn, RenderContext } from "@r-a-i-t-h/tessera-renderer";
import { buildDatasetViewPayload } from "./dataset-payload.js";
import { mountDatasetViewMarkup, registerDatasetElements } from "./dataset-element.js";

export { queryOptionsFromProps } from "./dataset-present-props.js";

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

function mediaLabel(ctx: RenderContext, assetId: string): string {
  const media = ctx.document.media.find((m) => m.id === assetId);
  return media?.title?.trim() || assetId;
}

function mediaUrl(ctx: RenderContext, assetId: string): string | undefined {
  const media = ctx.document.media.find((m) => m.id === assetId);
  return media?.url;
}

function mountView(ctx: RenderContext, props: Record<string, unknown>, variant: "table" | "cards" | "list"): string {
  registerDatasetElements();
  const snapshots = snapshotsFrom(ctx);
  const display = displayContext(snapshots);
  display.assetLabel = (id) => mediaLabel(ctx, id);
  display.assetUrl = (id) => mediaUrl(ctx, id);
  const payload = buildDatasetViewPayload(ctx, props, variant, display);
  if (!payload) return `<!-- dataset view: missing dataset -->`;
  if (!payload.rows.length) {
    const text = payload.empty.trim();
    if (!text) return "";
    return `<p class="wh-muted"><em>${ctx.escapeHtml(text)}</em></p>`;
  }
  return mountDatasetViewMarkup(payload);
}

export const datasetTable: ComponentFn = (ctx, props = {}) => mountView(ctx, props, "table");

export const datasetCards: ComponentFn = (ctx, props = {}) => mountView(ctx, props, "cards");

export const datasetPlainList: ComponentFn = (ctx, props = {}) => mountView(ctx, props, "list");
