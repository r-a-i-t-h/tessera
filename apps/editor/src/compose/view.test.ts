import { describe, expect, it } from "vitest";
import type { PageLayoutHint } from "../api.js";
import {
  addFrameZoneToRecord,
  composeFormInner,
  frameFormInner,
  htmlByZoneForMode,
  validateFrameZoneId,
} from "./view.js";
import { withZoneHtml } from "./draft.js";

const layout: PageLayoutHint = {
  layoutId: "tessera-article",
  layoutSource: "type",
  fields: [],
  declaredZones: ["title", "main"],
  offLayoutZones: [],
  layouts: {},
  frames: [],
};

const pageLayout: PageLayoutHint = {
  layoutId: "standard",
  layoutSource: "site",
  fields: [],
  declaredZones: ["title", "main"],
  offLayoutZones: ["sidebar_target"],
  frameZoneCatalog: ["events_aside", "sidebar_target"],
  frameEditorZones: ["sidebar_target"],
  activeFrameZoneIds: ["sidebar_target"],
  layouts: {
    standard: { zones: ["title", "main"] },
    master: { zones: ["sidebar_target"] },
  },
  frames: ["master", "events-frame"],
  masterLayoutId: "master",
  masterSource: "site",
};

describe("composeFormInner", () => {
  it("shows only the body canvas for an article (properties stay on Page)", () => {
    const html = composeFormInner(
      "content",
      {
        id: "fair",
        title: "Summer fair",
        type: "article",
        parentId: "hall",
        fields: { date: "2026-10-09" },
        zones: { title: { html: "Summer fair" }, main: { html: "<p>Body</p>" } },
      },
      layout,
      [],
    );
    expect(html).toContain('data-zone="main"');
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain("editor-props-inline");
    expect(html).not.toContain("Off layout");
    expect(html).not.toContain('data-zone="title"');
  });

  it("keeps off-layout zones and page property fields off the Compose tab", () => {
    const html = composeFormInner(
      "content",
      {
        id: "home",
        title: "Home",
        zones: {
          title: { html: "Home" },
          main: { html: "<p>Body</p>" },
          sidebar_target: { html: "<p>Quote</p>" },
        },
      },
      pageLayout,
      [],
    );
    expect(html).toContain('data-zone="main"');
    expect(html).toContain('data-zone="title"');
    expect(html).not.toContain('data-zone="sidebar_target"');
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain("Off layout");
  });
});

describe("frameFormInner", () => {
  it("shows frame editor zones and Add zone, not page-layout zones", () => {
    const html = frameFormInner(
      "content",
      {
        id: "home",
        title: "Home",
        zones: {
          title: { html: "Home" },
          main: { html: "<p>Body</p>" },
          sidebar_target: { html: "<p>Quote</p>" },
        },
      },
      pageLayout,
      [],
    );
    expect(html).toContain('data-zone="sidebar_target"');
    expect(html).not.toContain('data-zone="main"');
    expect(html).not.toContain('data-zone="title"');
    expect(html).not.toContain('name="title"');
    expect(html).toContain("Add zone");
    expect(html).toContain('name="frame-zone-pick"');
    expect(html).toContain('name="frame-zone-id"');
    expect(html).toContain("sidebar_target");
    expect(html).toContain("On current frame");
  });
});

describe("htmlByZoneForMode", () => {
  it("splits page-layout and frame zone HTML", () => {
    const record = {
      id: "home",
      title: "Home",
      zones: {
        main: { html: "<p>Body</p>" },
        sidebar_target: { html: "<p>Quote</p>" },
      },
    };
    expect(htmlByZoneForMode(record, pageLayout, "compose")).toEqual({
      title: "",
      main: "<p>Body</p>",
    });
    expect(htmlByZoneForMode(record, pageLayout, "frame")).toEqual({
      sidebar_target: "<p>Quote</p>",
    });
  });
});

describe("validateFrameZoneId", () => {
  it("rejects page-layout zones and duplicates", () => {
    const record = {
      id: "home",
      zones: { main: { html: "" }, sidebar_target: { html: "" } },
    };
    expect(validateFrameZoneId("main", record, pageLayout)).toMatchObject({ ok: false });
    expect(validateFrameZoneId("sidebar_target", record, pageLayout)).toMatchObject({ ok: false });
    expect(validateFrameZoneId("events_aside", record, pageLayout)).toEqual({
      ok: true,
      id: "events_aside",
    });
  });
});

describe("frame zone draft merge", () => {
  it("keeps compose zones when saving frame HTML", () => {
    const base = {
      id: "home",
      title: "Home",
      zones: {
        main: { html: "<p>Body</p>" },
        sidebar_target: { html: "<p>Old</p>" },
      },
    };
    const withNew = addFrameZoneToRecord(base, "events_aside");
    const merged = withZoneHtml(withNew, {
      sidebar_target: "<p>Quote</p>",
      events_aside: "<p>Aside</p>",
    });
    expect(merged.zones).toEqual({
      main: { html: "<p>Body</p>" },
      sidebar_target: { html: "<p>Quote</p>" },
      events_aside: { html: "<p>Aside</p>" },
    });
  });
});
