import { describe, expect, it } from "vitest";
import { applySubmitted, renderForm } from "./form.js";
import {
  ARTICLE_FORM,
  CONTENT_FORM,
  SITE_FORM,
  frameWhere,
  schemaFor,
  withAspectChoices,
  withDefaultAspectChoices,
  withFrameChoices,
  withParentChoices,
  withTypeChoices,
} from "./schema.js";

describe("schema forms", () => {
  it("orders site fields in two-column pairs", () => {
    expect(SITE_FORM.fields.map((field) => field.name)).toEqual([
      "id",
      "homePageId",
      "title",
      "masterLayoutId",
      "origin",
      "defaultLayoutId",
      "publishTo",
      "defaultAspectId",
      "delivery",
      "backToTop",
      "historyMaxAgeDays",
      "version",
      "historyMaxEntries",
    ]);
  });

  it("offers flavour and origin on a site that has neither", () => {
    const html = renderForm(SITE_FORM, { id: "hall", title: "Hall", homePageId: "home" });
    expect(html).toContain("Back to top");
    expect(html).toContain("Flavour");
    expect(html).toContain('value="pages"');
    expect(html).toContain("selected");
    expect(html).toContain("Snapshot");
    expect(html).toContain('type="url"');
    expect(html).toContain('name="origin"');
    expect(html).toContain('name="publishTo"');
  });

  it("writes delivery and omits a blank origin", () => {
    const next = applySubmitted(
      SITE_FORM,
      { id: "hall", title: "Hall", homePageId: "home" },
      { title: "Hall", homePageId: "home", delivery: "snapshot", origin: "  ", publishTo: "  " },
    );
    expect(next.delivery).toBe("snapshot");
    expect(next).not.toHaveProperty("origin");
    expect(next).not.toHaveProperty("publishTo");
    expect(next.id).toBe("hall");
  });

  it("orders content fields as id/parent, title/frame, type/aspect, description/nav, tags/published", () => {
    expect(CONTENT_FORM.fields.map((field) => field.name)).toEqual([
      "id",
      "parentId",
      "title",
      "masterLayoutId",
      "type",
      "aspectId",
      "description",
      "showInNav",
      "tags",
      "published",
    ]);
  });

  it("orders article fields as id/tags, title/aspect, description/published", () => {
    expect(ARTICLE_FORM.fields.map((field) => field.name)).toEqual([
      "id",
      "tags",
      "title",
      "aspectId",
      "description",
      "published",
    ]);
  });

  it("lays short content fields, including description, in two columns", () => {
    const html = renderForm(CONTENT_FORM, { id: "home", title: "Home", description: "A hall" });
    expect(html.startsWith(`<div class="editor-props">`)).toBe(true);
    expect(html).not.toContain("editor-props-inline");
    expect(html).toContain(`<p><label for="f-description">Description</label>`);
    expect(html).toContain(`<input id="f-description" name="description" type="text"`);
    expect(html).not.toContain(`<textarea id="f-description"`);
    expect(html).toContain(`<p><label for="f-title">Title</label>`);
    expect(html).not.toContain(`editor-prop-wide"><label for="f-title"`);
    expect(html).not.toContain(`editor-prop-wide"><label for="f-description"`);
  });

  it("opts into side labels for the page form", () => {
    const html = renderForm(CONTENT_FORM, { id: "home", title: "Home" }, { inline: true });
    expect(html.startsWith(`<div class="editor-props editor-props-inline">`)).toBe(true);
    expect(html).toContain("editor-prop-control");
  });

  it("offers other page ids as the parent and clears None", () => {
    const schema = withParentChoices(CONTENT_FORM, ["home", "about", "events"], "about", "gone");
    const html = renderForm(schema, { id: "about", title: "About", parentId: "gone" });
    expect(html).toContain('name="parentId"');
    expect(html).toContain('data-kind="select"');
    expect(html).toContain(">None</option>");
    expect(html).toContain('value="home"');
    expect(html).toContain('value="events"');
    expect(html).toContain('value="gone"');
    expect(html).not.toContain('<option value="about"');
    const cleared = applySubmitted(schema, { id: "about", title: "About", parentId: "home" }, {
      title: "About",
      parentId: "",
    });
    expect(cleared).not.toHaveProperty("parentId");
    const set = applySubmitted(schema, { id: "about", title: "About" }, { title: "About", parentId: "events" });
    expect(set.parentId).toBe("events");
  });

  it("shows showInNav checked when the key is missing and omits it when checked", () => {
    const html = renderForm(CONTENT_FORM, { id: "home", title: "Home" });
    expect(html).toContain("Show in nav");
    expect(html).toContain('name="showInNav"');
    expect(html).toContain('name="published"');
    expect(html).toContain("checked");
    const kept = applySubmitted(CONTENT_FORM, { id: "home", title: "Home" }, { title: "Home", showInNav: true, tags: "" });
    expect(kept).not.toHaveProperty("showInNav");
    const hidden = applySubmitted(
      CONTENT_FORM,
      { id: "home", title: "Home" },
      { title: "Home", showInNav: false, tags: "news, hall" },
    );
    expect(hidden.showInNav).toBe(false);
    expect(hidden).not.toHaveProperty("published");
    expect(hidden.tags).toEqual(["news", "hall"]);
    const draft = applySubmitted(CONTENT_FORM, { id: "home", title: "Home" }, { title: "Home", published: false });
    expect(draft.published).toBe(false);
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

  it("offers inherit for the page aspect and omits it when blank", () => {
    const aspects = [
      { id: "summer", label: "Summer" },
      { id: "night", label: "Night" },
    ];
    const schema = withAspectChoices(CONTENT_FORM, aspects);
    const html = renderForm(schema, { id: "fair", title: "Fair" });
    expect(html).toContain("Aspect");
    expect(html).toContain(">Inherit</option>");
    expect(html).toContain(">Summer</option>");
    expect(html).toContain(">Night</option>");
    const cleared = applySubmitted(schema, { id: "fair", title: "Fair", aspectId: "night" }, {
      title: "Fair",
      aspectId: "",
    });
    expect(cleared).not.toHaveProperty("aspectId");
    const set = applySubmitted(schema, { id: "events", title: "Events" }, { title: "Events", aspectId: "night" });
    expect(set.aspectId).toBe("night");
    const hidden = withAspectChoices(CONTENT_FORM, []);
    expect(hidden.fields.find((field) => field.name === "aspectId")).toBeUndefined();
    const kept = withAspectChoices(CONTENT_FORM, [], "legacy");
    const orphanHtml = renderForm(kept, { id: "fair", title: "Fair", aspectId: "legacy" });
    expect(orphanHtml).toContain('value="__non_theme__" selected');
    expect(orphanHtml).toContain(">non-theme aspect specified</option>");
    expect(
      applySubmitted(kept, { id: "fair", title: "Fair", aspectId: "legacy" }, {
        title: "Fair",
        aspectId: "__non_theme__",
      }).aspectId,
    ).toBe("legacy");
    expect(
      applySubmitted(CONTENT_FORM, { id: "fair", title: "Fair", aspectId: "legacy" }, {
        title: "Fair",
        aspectId: "__non_theme__",
      }).aspectId,
    ).toBe("legacy");
    expect(
      applySubmitted(kept, { id: "fair", title: "Fair", aspectId: "legacy" }, {
        title: "Fair",
        aspectId: "",
      }),
    ).not.toHaveProperty("aspectId");
    expect(
      applySubmitted(withAspectChoices(CONTENT_FORM, aspects, "legacy"), { id: "fair", title: "Fair", aspectId: "legacy" }, {
        title: "Fair",
        aspectId: "night",
      }).aspectId,
    ).toBe("night");
    const siteSchema = withDefaultAspectChoices(SITE_FORM, aspects);
    expect(renderForm(siteSchema, { id: "s", title: "S", homePageId: "home" })).toContain(">None</option>");
    expect(withDefaultAspectChoices(SITE_FORM, []).fields.find((field) => field.name === "defaultAspectId")).toBeUndefined();
    expect(schemaFor("site", { id: "s", title: "S", homePageId: "home", aspects: aspects })?.fields.find((f) => f.name === "aspects")).toBeUndefined();
    const panelTonesSchema = schemaFor("site", {
      id: "s",
      title: "S",
      homePageId: "home",
      panelTones: [{ id: "ma-blue", label: "School blue", className: "ma-panel-blue" }],
    });
    expect(panelTonesSchema?.fields.find((f) => f.name === "panelTones")).toMatchObject({
      name: "panelTones",
      type: "yaml",
    });
    expect(renderForm(panelTonesSchema!, { panelTones: [{ id: "ma-blue", label: "School blue", className: "ma-panel-blue" }] })).toContain(
      'href="#/styles?sheet=local">Site local</a>',
    );
    const styleSchema = schemaFor("site", {
      id: "s",
      title: "S",
      homePageId: "home",
      style: { bar: "#112233" },
    });
    expect(styleSchema?.fields.find((f) => f.name === "style")?.helpHtml).toContain('href="#/styles?sheet=tessera"');
    expect(renderForm({ fields: styleSchema!.fields.filter((f) => f.name === "style") }, { style: { bar: "#112233" } })).toContain(
      'href="#/styles?sheet=tessera">Tessera</a>',
    );
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
    expect(html).toContain("editor-prop-wide");
    expect(html).toContain('data-kind="yaml"');
    expect(html).toContain('spellcheck="false"');
    expect(html).toContain("data-code-wrap");
    expect(html).toContain("Word wrap");
    expect(html).toContain('aria-controls="f-meta"');
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

  it("offers Includes on a layout and omits it when blank", () => {
    const record = { id: "master", root: { type: "page" } };
    const schema = schemaFor("layouts", record);
    const includes = schema?.fields.find((field) => field.name === "includes");
    expect(includes).toMatchObject({ type: "string", list: true });
    expect(schema?.fields.some((field) => field.name === "root")).toBe(true);
    const html = renderForm({ fields: schema?.fields ?? [] }, record);
    expect(html).toContain('name="includes"');
    const cleared = applySubmitted(schema!, record, { includes: "  " });
    expect(cleared).not.toHaveProperty("includes");
    const set = applySubmitted(schema!, record, { includes: "site-header, common-footer" });
    expect(set.includes).toEqual(["site-header", "common-footer"]);
    expect(set.root).toEqual({ type: "page" });
  });

  it("keeps an item’s zones out of the field list", () => {
    const schema = schemaFor("items", {
      id: "common-footer",
      zones: { footer: { html: "<p>New site</p>" } },
    });
    expect(schema?.fields.map((field) => field.name)).toEqual(["id", "tags"]);
    const html = renderForm(schema ?? { fields: [] }, { id: "common-footer" });
    expect(html).toContain('name="tags"');
    expect(html).not.toContain("zones");
    expect(html).not.toContain("editor-yaml");
  });
});
