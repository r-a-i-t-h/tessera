import { describe, expect, it } from "vitest";
import { applySubmitted, renderForm } from "./form.js";
import { CONTENT_FORM, SITE_FORM, frameWhere, schemaFor, withFrameChoices, withTypeChoices } from "./schema.js";

describe("schema forms", () => {
  it("offers flavour and origin on a site that has neither", () => {
    const html = renderForm(SITE_FORM, { id: "hall", title: "Hall", homePageId: "home" });
    expect(html).toContain("Flavour");
    expect(html).toContain('value="pages"');
    expect(html).toContain("selected");
    expect(html).toContain("Snapshot");
    expect(html).toContain('type="url"');
    expect(html).toContain('name="origin"');
  });

  it("writes delivery and omits a blank origin", () => {
    const next = applySubmitted(
      SITE_FORM,
      { id: "hall", title: "Hall", homePageId: "home" },
      { title: "Hall", homePageId: "home", delivery: "snapshot", origin: "  " },
    );
    expect(next.delivery).toBe("snapshot");
    expect(next).not.toHaveProperty("origin");
    expect(next.id).toBe("hall");
  });

  it("shows showInNav checked when the key is missing and omits it when checked", () => {
    const html = renderForm(CONTENT_FORM, { id: "home", title: "Home" });
    expect(html).toContain("Show in nav");
    expect(html).toContain('name="showInNav"');
    expect(html).toContain("checked");
    const kept = applySubmitted(CONTENT_FORM, { id: "home", title: "Home" }, { title: "Home", showInNav: true, tags: "" });
    expect(kept).not.toHaveProperty("showInNav");
    const hidden = applySubmitted(
      CONTENT_FORM,
      { id: "home", title: "Home" },
      { title: "Home", showInNav: false, tags: "news, hall" },
    );
    expect(hidden.showInNav).toBe(false);
    expect(hidden.tags).toEqual(["news", "hall"]);
  });

  it("offers inherit for the page frame and omits it when blank", () => {
    const schema = withFrameChoices(CONTENT_FORM, ["master", "events-frame"]);
    const html = renderForm(schema, { id: "fair", title: "Fair" });
    expect(html).toContain("Frame");
    expect(html).toContain(">Inherit</option>");
    expect(html).toContain("events-frame");
    const cleared = applySubmitted(schema, { id: "fair", title: "Fair", masterLayoutId: "events-frame" }, {
      title: "Fair",
      masterLayoutId: "",
    });
    expect(cleared).not.toHaveProperty("masterLayoutId");
    const set = applySubmitted(schema, { id: "events", title: "Events" }, { title: "Events", masterLayoutId: "events-frame" });
    expect(set.masterLayoutId).toBe("events-frame");
    expect(frameWhere("ancestor", "events")).toBe("set on events");
    expect(frameWhere("page")).toBe("set on this page");
    expect(frameWhere("site")).toBe("the site frame");
  });

  it("offers none for the page type and keeps an unknown id", () => {
    const schema = withTypeChoices(CONTENT_FORM, ["event", "meeting"]);
    const html = renderForm(schema, { id: "fair", title: "Fair" });
    expect(html).toContain(">None</option>");
    expect(html).toContain('value="" selected');
    expect(html).toContain('value="event"');
    expect(html).toContain('value="meeting"');
    const onlyNone = renderForm(withTypeChoices(CONTENT_FORM, []), { id: "fair", title: "Fair" });
    expect(onlyNone).toContain(">None</option>");
    expect(onlyNone).not.toContain('value="event"');
    const kept = withTypeChoices(CONTENT_FORM, ["event"], "retired");
    const retired = renderForm(kept, { id: "fair", title: "Fair", type: "retired" });
    expect(retired).toContain('value="retired" selected');
    const cleared = applySubmitted(schema, { id: "fair", title: "Fair", type: "event" }, { title: "Fair", type: "" });
    expect(cleared).not.toHaveProperty("type");
    const set = applySubmitted(schema, { id: "fair", title: "Fair" }, { title: "Fair", type: "meeting" });
    expect(set.type).toBe("meeting");
    const authored = schemaFor("content", { id: "fair", title: "Fair", type: "event" });
    expect(authored?.fields.find((field) => field.name === "type")?.type).toBe("string");
  });

  it("uses a fixed-width class on yaml fields", () => {
    const html = renderForm(
      { fields: [{ name: "meta", label: "Meta", type: "yaml", rows: 10 }] },
      { meta: { role: "Host" } },
    );
    expect(html).toContain("editor-yaml");
    expect(html).toContain('data-kind="yaml"');
    expect(html).toContain('spellcheck="false"');
  });

  it("keeps keys the content schema does not name", () => {
    const schema = schemaFor("content", {
      id: "ada",
      title: "Ada",
      zones: { main: { html: "<p>Hi</p>" } },
      meta: { role: "Host" },
    });
    expect(schema?.fields.some((field) => field.name === "showInNav")).toBe(true);
    expect(schema?.fields.some((field) => field.name === "meta" && field.type === "yaml")).toBe(true);
    expect(schema?.fields.some((field) => field.name === "zones")).toBe(false);
  });
});
