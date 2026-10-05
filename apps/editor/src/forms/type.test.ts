import { describe, expect, it } from "vitest";
import { applyTypeAction, draftFromControls, renderTypeForm, typeDraft, typeFieldError, typeRecord } from "./type.js";
import type { ControlValue } from "./nav.js";

const event = {
  id: "event",
  layoutId: "article",
  fields: [
    { id: "date", required: true },
    { id: "precis", required: true, note: "keep" },
    { id: "time" },
    { id: "where" },
  ],
  note: "hall",
};

const layouts = [{ id: "article" }, { id: "standard" }, { id: "profile" }];

describe("type form", () => {
  it("renders the layout, the fields, and required only when set", () => {
    const html = renderTypeForm(typeDraft(event), layouts);
    expect(html).toContain('value="event" disabled');
    expect(html).toContain(">Site default<");
    expect(html).toContain('value="article" selected');
    expect(html).toContain('value="date"');
    expect(html).toContain('value="precis"');
    expect(html).toContain("Add field");
    expect(html).toContain('aria-label="Up"');
    expect(html).toContain('aria-label="Remove"');
    const required = html.match(/<input\b[^>]*name="type-field-0-required"[^>]*>/)?.[0] ?? "";
    expect(required).toContain("checked");
    const optional = html.match(/<input\b[^>]*name="type-field-2-required"[^>]*>/)?.[0] ?? "";
    expect(optional).not.toContain("checked");
  });

  it("keeps a layout that is not in the choice list", () => {
    const html = renderTypeForm(typeDraft({ id: "event", layoutId: "missing" }), []);
    expect(html).toContain('value="missing" selected');
  });

  it("reorders fields", () => {
    const draft = typeDraft(event);
    const moved = applyTypeAction(draft, "down", 0);
    expect(moved.fields.map((field) => field.id)).toEqual(["precis", "date", "time", "where"]);
    const added = applyTypeAction(moved, "add-field");
    expect(added.fields.at(-1)).toEqual({ id: "", required: false, extra: {} });
    const removed = applyTypeAction(added, "remove", added.fields.length - 1);
    expect(removed.fields.map((field) => field.id)).toEqual(["precis", "date", "time", "where"]);
  });

  it("round-trips layout, fields, required, and extra keys", () => {
    const html = renderTypeForm(typeDraft(event), layouts);
    const draft = draftFromControls(controlsIn(html), "event");
    expect(typeRecord("event", draft)).toEqual(event);
  });

  it("omits a blank layout and an unchecked required flag", () => {
    const draft = typeDraft({ id: "note", fields: [{ id: "precis", required: false }] });
    expect(typeRecord("note", draft)).toEqual({ id: "note", fields: [{ id: "precis" }] });
  });

  it("rejects a blank field id and a repeated field id", () => {
    expect(typeFieldError([{ id: "date" }, { id: "  " }])).toBe("Each field needs an id.");
    expect(typeFieldError([{ id: "date" }, { id: " date " }])).toBe("Field date is listed twice.");
    expect(typeFieldError([{ id: "date" }, { id: "precis" }])).toBeUndefined();
  });
});

function controlsIn(html: string): ControlValue[] {
  const controls: ControlValue[] = [];
  for (const match of html.matchAll(/<input\b([^>]*?)\/?>/g)) {
    const attrs = attrsOf(match[1] ?? "");
    if (!attrs.name) continue;
    controls.push({
      name: attrs.name,
      value: attrs.value ?? "",
      checked: attrs.type === "checkbox" ? Object.prototype.hasOwnProperty.call(attrs, "checked") : undefined,
    });
  }
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const attrs = attrsOf(match[1] ?? "");
    if (!attrs.name) continue;
    const options = [...(match[2] ?? "").matchAll(/<option\b([^>]*)>/g)];
    const selected = options.find((option) => /(?:^|\s)selected(?:\s|=|$)/.test(option[1] ?? ""));
    const chosen = attrsOf((selected ?? options[0])?.[1] ?? "");
    controls.push({ name: attrs.name, value: chosen.value ?? "" });
  }
  return controls;
}

function attrsOf(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) {
    const key = match[1];
    if (!key) continue;
    attrs[key] = match[2] !== undefined ? decodeAttr(match[2]) : "";
  }
  return attrs;
}

function decodeAttr(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
