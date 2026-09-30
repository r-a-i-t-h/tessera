import { describe, expect, it } from "vitest";
import { blankSection, paintSections, parseSections, youtubeVideoId, type Section } from "./index.js";

const ineffable = `
<p class="w3-large">Tessera stands for zone-based site tiles.</p>
<p>The W3-CSS framework is the chosen rendering target.</p>
<div class="w3-content w3-padding-16" style="max-width: 70%">
  <div class="w3-panel w3-card-4 w3-round-large w3-sand">
    <p class="w3-left-align"><i class="fa fa-quote-left w3-xlarge w3-text-black w3-opacity-max"></i></p>
    <p class="w3-xlarge w3-serif w3-center">They can't both be best, so take the best of both.</p>
    <p class="w3-right-align"><i class="fa fa-quote-right w3-xlarge w3-text-black w3-opacity-max"></i></p>
  </div>
</div>
<div class="w3-section w3-cell-row">
  <div class="w3-cell w3-container w3-mobile w3-orange"><h3>TO DO</h3>
    <ul>
      <li>gallery
      <li>fanciness
    </ul></div><div class="w3-cell w3-container w3-mobile w3-teal"><h3>DONE</h3>
    <ul>
      <li>cache-busting
      <li>dynamic menus
    </ul></div>
</div>`;

const willow = `
<h2>This week at a glance</h2>
<p>Mauris blandit aliquet elit.</p>
<h2>Who keeps the kettle on</h2>
<p>Trustees and volunteer leads.</p>
{{people-preview}}
<p><a href="#people">Meet the whole team</a></p>
<h2>From the hall</h2>
{{hall-gallery-slides}}`;

describe("parseSections", () => {
  it("splits a Willow body into headings, paragraphs, and inserts", () => {
    const sections = parseSections(willow);
    expect(sections.map((section) => section.kind)).toEqual([
      "heading",
      "text",
      "heading",
      "text",
      "insert",
      "text",
      "heading",
      "insert",
    ]);
    expect(sections[0]).toMatchObject({ kind: "heading", text: "This week at a glance" });
    expect(sections[4]).toEqual({ kind: "insert", id: "people-preview" });
    expect(sections[5]).toMatchObject({ kind: "text", html: `<a href="#people">Meet the whole team</a>` });
    expect(sections[7]).toEqual({ kind: "insert", id: "hall-gallery-slides" });
  });

  it("splits an Ineffable body into paragraphs, a quote, and columns", () => {
    const sections = parseSections(ineffable);
    expect(sections.map((section) => section.kind)).toEqual(["text", "text", "quote", "columns"]);
    expect(sections[2]).toMatchObject({
      kind: "quote",
      tone: "sand",
      text: "They can't both be best, so take the best of both.",
      attribution: "",
    });
    const columns = sections[3];
    expect(columns).toMatchObject({ kind: "columns" });
    if (columns?.kind !== "columns") return;
    expect(columns.cells).toHaveLength(2);
    expect(columns.cells[0]?.className).toBe("w3-orange");
    expect(columns.cells[0]?.sections[0]).toMatchObject({ kind: "heading", text: "TO DO" });
    expect(columns.cells[1]?.className).toBe("w3-teal");
    expect(columns.cells[1]?.sections[0]).toMatchObject({ kind: "heading", text: "DONE" });
  });

  it("keeps an unrecognized hero as one HTML section", () => {
    const html = `<div class="wh-hero"><p class="wh-kicker">Neighbourhood hall</p><h2>A room</h2></div>`;
    const sections = parseSections(html);
    expect(sections).toEqual([{ kind: "html", html }]);
    expect(parseSections(paintSections(sections))).toEqual(sections);
  });

  it("unwraps a bare div and recognizes a panel and an image box", () => {
    const html = `<div><div class="w3-panel w3-pale-blue w3-padding"><p>Gallery</p></div><div class="w3-display-container w3-container w3-padding-16 w3-card w3-center"><img src="photo.jpg" class="w3-image" style="width: 100%" alt="Sheep"><div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white">Open days</div></div></div>`;
    expect(parseSections(html)).toEqual([
      { kind: "panel", tone: "pale-blue", html: "<p>Gallery</p>" },
      { kind: "imgbox", src: "photo.jpg", alt: "Sheep", caption: "Open days" },
    ]);
  });
});

describe("paintSections", () => {
  it("rebuilds the same sections from painted HTML", () => {
    const sections: Section[] = [
      { kind: "heading", level: 2, text: "Hello" },
      { kind: "text", tag: "p", html: "A <strong>line</strong>." },
      { kind: "text", tag: "ul", html: "<li>One</li><li>Two</li>" },
      { kind: "panel", tone: "sand", html: "<p>Note</p>" },
      { kind: "quote", tone: "pale", text: "Stay curious", attribution: "Ada" },
      { kind: "imgbox", src: "a.jpg", alt: "Alt", caption: "Caption" },
      { kind: "card", title: "Card", html: "<p>Body</p>" },
      {
        kind: "columns",
        cells: [
          { className: "w3-orange", sections: [{ kind: "heading", level: 3, text: "Left" }] },
          { className: "", sections: [{ kind: "text", tag: "p", html: "Right" }] },
          { className: "", sections: [blankSection("text")] },
        ],
      },
      { kind: "insert", id: "people-preview" },
      { kind: "subpages", title: "In this section" },
      { kind: "youtube", videoId: "QvAdmE0vPW0", title: "Lambs in the barn" },
      { kind: "gallery", folder: "lambs", mode: "slides" },
      { kind: "pasted", html: "<p>A short line.</p><p>And another paragraph that the sheet grows to fit.</p>" },
      { kind: "html", html: `<div class="wh-hero"><p>Keep</p></div>` },
    ];
    expect(parseSections(paintSections(sections))).toEqual(sections);
  });

  it("paints quote, panel, image box, and columns with W3 classes", () => {
    const html = paintSections([
      { kind: "quote", tone: "sand", text: "Words", attribution: "" },
      { kind: "panel", tone: "theme", html: "<p>Panel</p>" },
      { kind: "imgbox", src: "a.jpg", alt: "", caption: "Cap" },
      blankSection("columns"),
    ]);
    expect(html).toContain("w3-panel");
    expect(html).toContain("w3-sand");
    expect(html).toContain("fa-quote-left");
    expect(html).toContain("w3-theme-l4");
    expect(html).toContain("w3-display-container");
    expect(html).toContain('src="a.jpg"');
    expect(html).toContain("w3-row-padding");
    expect(html).toContain("w3-half");
  });

  it("leaves a binding token in the painted HTML", () => {
    expect(paintSections([{ kind: "insert", id: "people-preview" }])).toBe("{{people-preview}}");
  });

  it("paints subpages, youtube, gallery, and a pasted note with stable markers", () => {
    const html = paintSections([
      { kind: "subpages", title: "Visit" },
      { kind: "youtube", videoId: "https://www.youtube.com/watch?v=QvAdmE0vPW0", title: "Farm" },
      { kind: "gallery", folder: "lambs", mode: "grid" },
      { kind: "pasted", html: "<p>Author text</p>" },
    ]);
    expect(html).toContain('data-tessera="subpages"');
    expect(html).toContain('data-title="Visit"');
    expect(html).toContain("https://www.youtube-nocookie.com/embed/QvAdmE0vPW0");
    expect(html).toContain('class="tessera-video w3-card w3-margin-bottom"');
    expect(html).toContain('data-tessera="gallery"');
    expect(html).toContain('data-mode="grid"');
    expect(html).toContain("tessera-pasted-sheet");
    expect(html).toContain("<p>Author text</p>");
    expect(html).not.toContain("BABIES");
  });

  it("reads a YouTube id from a watch, share, or embed address", () => {
    expect(youtubeVideoId("QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube.com/watch?v=QvAdmE0vPW0&t=12")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://youtu.be/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube-nocookie.com/embed/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube.com/shorts/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("not a video")).toBe("");
  });

  it("leaves an old tilted farm block as custom HTML", () => {
    const html = `<div style="margin: 30px auto; padding: 40px; transform: rotate(-2deg);">Farm news stays here.</div>`;
    expect(parseSections(html)).toEqual([{ kind: "html", html }]);
  });
});
