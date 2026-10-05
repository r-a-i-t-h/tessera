import { describe, expect, it } from "vitest";
import {
  bindingIdsIn,
  bindingSentence,
  datedDraft,
  datedRecord,
  galleryDraft,
  galleryDraftFromForm,
  galleryRecord,
  limitError,
  linksRecord,
  navHeadings,
  newBindingError,
  newBindingRecord,
  peopleRecord,
  readNewBinding,
  renderBindingForm,
  renderDatedForm,
  renderGalleryForm,
  renderLinksForm,
  renderNewBinding,
  blankNewBinding,
} from "./binding.js";

const hall = {
  id: "hall-gallery",
  component: "gallery",
  props: { folders: ["hall-gallery"], mode: "grid" },
};

const slides = {
  id: "hall-gallery-slides",
  component: "gallery",
  props: { folders: ["hall-gallery"], mode: "slides", autoplay: true },
};

const upcoming = {
  id: "upcoming-events",
  component: "datedList",
  props: { types: ["event"], when: "upcoming", limit: 3 },
};

describe("binding sentences", () => {
  it("describes a gallery, a dated list, and a people grid with the pages that use them", () => {
    expect(bindingSentence(hall, [{ id: "gallery", title: "Gallery" }])).toBe(
      "Grid of the hall-gallery folder. On Gallery.",
    );
    expect(bindingSentence(slides)).toBe("Slides of the hall-gallery folder.");
    expect(bindingSentence(upcoming, [{ id: "home", title: "Home" }])).toBe("The next 3 event pages. On Home.");
    expect(
      bindingSentence(
        { component: "peopleGrid", props: { types: ["person"] } },
        [{ id: "people", title: "People" }],
      ),
    ).toBe("Every person page. On People.");
    expect(bindingSentence({ component: "peopleGrid", props: { types: ["person"], limit: 3 } })).toBe(
      "The first 3 person pages.",
    );
  });

  it("names several folders, pages, and the other list windows", () => {
    expect(
      bindingSentence({
        component: "gallery",
        props: { folders: ["hall-gallery", "lambs"], mode: "slides" },
      }),
    ).toBe("Slides of the hall-gallery and lambs folders.");
    expect(bindingSentence({ component: "gallery", props: { mode: "grid" } })).toBe("A gallery with no folders yet.");
    expect(bindingSentence({ component: "datedList", props: { types: ["news"], when: "past", limit: 3 } })).toBe(
      "The latest 3 news pages.",
    );
    expect(bindingSentence({ component: "datedList", props: { types: ["event"], when: "all" } })).toBe(
      "Every event page.",
    );
    expect(bindingSentence({ component: "datedList", props: {} })).toBe("A dated list with no type yet.");
    expect(
      bindingSentence(hall, [
        { id: "home", title: "Home" },
        { id: "gallery", title: "Gallery" },
      ]),
    ).toBe("Grid of the hall-gallery folder. On Home and Gallery.");
    expect(
      bindingSentence(hall, [
        { id: "home", title: "Home" },
        { id: "gallery", title: "Gallery" },
        { id: "events", title: "Events" },
      ]),
    ).toBe("Grid of the hall-gallery folder. On Home, Gallery, and Events.");
  });

  it("describes link groups and leaves unknown components on the raw file", () => {
    expect(bindingSentence({ component: "linkCluster", props: { source: "children", variant: "list" } })).toBe(
      "A list of this page's children.",
    );
    expect(bindingSentence({ component: "linkCluster", props: { source: "type", type: "event", variant: "pills" } })).toBe(
      "Pills for every event page.",
    );
    expect(
      bindingSentence({ component: "linkCluster", props: { source: "nav", heading: "What's on", variant: "cards" } }),
    ).toBe("Cards for the What's on menu.");
    expect(bindingSentence({ component: "eventList" })).toBe("eventList. Edit the raw file.");
  });
});

describe("binding records", () => {
  it("writes a gallery folder list even for one folder, and keeps autoplay for slides", () => {
    expect(galleryRecord("hall-gallery", galleryDraft(hall)).props).toEqual({
      folders: ["hall-gallery"],
      mode: "grid",
    });
    const draft = galleryDraft(slides);
    draft.filter = "2024";
    expect(galleryRecord("hall-gallery-slides", draft).props).toEqual({
      folders: ["hall-gallery"],
      filter: "2024",
      mode: "slides",
      autoplay: true,
    });
    const grid = galleryDraft(slides);
    grid.mode = "grid";
    expect(galleryRecord("hall-gallery", grid).props).not.toHaveProperty("autoplay");
  });

  it("reads a single folder string and keeps item data", () => {
    const draft = galleryDraft({
      id: "hall",
      component: "gallery",
      itemId: "photos",
      props: { folder: "hall", mode: "grid", caption: "Porch" },
    });
    expect(draft.folders).toEqual(["hall"]);
    expect(draft.propsExtra).toEqual({ caption: "Porch" });
    expect(galleryRecord("hall", draft)).toMatchObject({
      itemId: "photos",
      props: { folders: ["hall"], mode: "grid", caption: "Porch" },
    });
  });

  it("reads an older dated list and writes types and when", () => {
    const draft = datedDraft({
      component: "datedList",
      props: { type: "event", upcoming: true, limit: 3, empty: "None yet." },
    });
    expect(draft.types).toEqual(["event"]);
    expect(draft.when).toBe("upcoming");
    expect(datedRecord("upcoming-events", draft)).toEqual({
      id: "upcoming-events",
      component: "datedList",
      props: { types: ["event"], when: "upcoming", limit: 3, empty: "None yet." },
    });
  });

  it("omits an empty people type list and drops a link type when the source is children", () => {
    expect(peopleRecord("people-grid", { types: [], limit: "", propsExtra: {}, recordExtra: {} })).toEqual({
      id: "people-grid",
      component: "peopleGrid",
    });
    expect(
      linksRecord("pills", {
        title: "What's on",
        source: "children",
        type: "event",
        heading: "Events",
        variant: "pills",
        propsExtra: {},
        recordExtra: {},
      }).props,
    ).toEqual({ source: "children", variant: "pills", title: "What's on" });
  });

  it("finds insert tokens and nav headings", () => {
    expect(bindingIdsIn({ zones: { main: { html: "Hello {{upcoming-events}} and {{hall-gallery}} {{upcoming-events}}" } } })).toEqual([
      "upcoming-events",
      "hall-gallery",
    ]);
    expect(navHeadings([{ heading: "What's on", children: [{ id: "home" }, { heading: "People" }] }])).toEqual([
      "What's on",
      "People",
    ]);
  });
});

describe("binding forms", () => {
  it("shows the gallery questions on one page", () => {
    const html = renderGalleryForm("hall-gallery", galleryDraft(hall), [{ id: "hall-gallery" }, { id: "lambs" }]);
    expect(html).toContain("A Gallery section in Compose stays on that one page.");
    expect(html).toContain("{{hall-gallery}}");
    expect(html).toContain('data-folder-id="hall-gallery" checked');
    expect(html).toContain("Only filenames matching");
    expect(html).toContain("data-gallery-autoplay hidden");
    const playing = renderGalleryForm("hall-gallery-slides", galleryDraft(slides), [{ id: "hall-gallery" }]);
    expect(playing).toContain("data-gallery-autoplay");
    expect(playing).not.toContain("data-gallery-autoplay hidden");
    expect(playing).toContain("checked");
  });

  it("explains a dated list and that children follow the page", () => {
    const dated = renderDatedForm("upcoming-events", datedDraft(upcoming), ["event", "news"]);
    expect(dated).toContain("Only pages with a date field are listed.");
    expect(dated).toContain('value="event" checked');
    const links = renderLinksForm(
      "whats-on",
      {
        title: "",
        source: "children",
        type: "",
        heading: "",
        variant: "list",
        propsExtra: {},
        recordExtra: {},
      },
      { folders: [], types: ["event"], headings: ["What's on"] },
    );
    expect(links).toContain("Children follow the page the insert sits on.");
    expect(links).toContain("data-links-type hidden");
    expect(renderBindingForm("upcoming-events", upcoming, { folders: [], types: ["event"], headings: [] })).toContain(
      "dated-when",
    );
  });

  it("walks a new gallery from the id to the pictures, then writes a folder list", () => {
    const start = renderNewBinding(blankNewBinding(), { folders: [], types: [], headings: [] });
    expect(start).toContain("data-binding-token");
    expect(start).toContain(">{{id}}</code>");
    expect(start).toContain(">Next</button>");
    const pictures = renderNewBinding(
      { ...blankNewBinding(), id: "lambs", step: 2, gallery: { ...galleryDraft({}), folders: ["lambs"] } },
      { folders: [{ id: "lambs" }], types: [], headings: [] },
    );
    expect(pictures).toContain(">{{lambs}}</code>");
    expect(pictures).toContain('data-folder-id="lambs"');
    const created = readNewBinding(
      [
        { name: "binding-kind", value: "gallery" },
        { name: "binding-id", value: "lambs" },
        { name: "binding-step", value: "3" },
        { name: "gallery-folder", value: "lambs" },
        { name: "gallery-filter", value: "2024" },
        { name: "gallery-mode", value: "slides" },
        { name: "gallery-autoplay", value: "on", checked: true },
      ],
    );
    expect(newBindingRecord(created)).toEqual({
      id: "lambs",
      component: "gallery",
      props: { folders: ["lambs"], filter: "2024", mode: "slides", autoplay: true },
    });
    expect(galleryDraftFromForm(created.gallery.folders.map(() => ({ name: "x", value: "" })), ["lambs"]).folders).toEqual([
      "lambs",
    ]);
  });

  it("rejects a bad limit and a duplicate id", () => {
    expect(limitError("")).toBeUndefined();
    expect(limitError("0")).toBe("Limit must be a whole number.");
    const state = { ...blankNewBinding(), kind: "other" as const, id: "hall", component: "" };
    expect(newBindingError(state, ["hall"])).toBe("A binding with id hall already exists.");
    expect(newBindingError({ ...state, id: "events", component: "" }, [])).toBe("Enter a component name.");
  });
});
