import { describe, expect, it } from "vitest";
import {
  blankSection,
  paintSections,
  parseSections,
  renderMarkdownLinks,
  restoreMarkdownLinks,
  youtubeVideoId,
  type ColumnLayoutId,
  type Section,
} from "./index.js";

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
  it("groups a Willow body into text runs, leaving a heading that introduces an insert", () => {
    const sections = parseSections(willow);
    expect(sections.map((section) => section.kind)).toEqual(["text", "text", "insert", "text", "heading", "insert"]);
    expect(sections[0]).toMatchObject({
      kind: "text",
      heading: "This week at a glance",
      level: 2,
      html: "<p>Mauris blandit aliquet elit.</p>",
    });
    expect(sections[1]).toMatchObject({
      kind: "text",
      heading: "Who keeps the kettle on",
      html: "<p>Trustees and volunteer leads.</p>",
    });
    expect(sections[2]).toEqual({ kind: "insert", id: "people-preview" });
    expect(sections[3]).toMatchObject({
      kind: "text",
      heading: "",
      html: `<p><a href="#people">Meet the whole team</a></p>`,
    });
    expect(sections[4]).toMatchObject({ kind: "heading", text: "From the hall" });
    expect(sections[5]).toEqual({ kind: "insert", id: "hall-gallery-slides" });
  });

  it("groups an Ineffable body into one text run, a quote, and columns", () => {
    const sections = parseSections(ineffable);
    expect(sections.map((section) => section.kind)).toEqual(["text", "quote", "columns"]);
    expect(sections[0]).toMatchObject({
      kind: "text",
      heading: "",
      html: `<p class="w3-large">Tessera stands for zone-based site tiles.</p><p>The W3-CSS framework is the chosen rendering target.</p>`,
    });
    expect(sections[1]).toMatchObject({
      kind: "quote",
      tone: "sand",
      text: "They can't both be best, so take the best of both.",
      attribution: "",
    });
    const columns = sections[2];
    expect(columns).toMatchObject({ kind: "columns" });
    if (columns?.kind !== "columns") return;
    expect(columns.layout).toBe("1:1");
    expect(columns.cells).toHaveLength(2);
    expect(columns.cells[0]?.className).toBe("w3-orange");
    expect(columns.cells[0]?.sections[0]).toMatchObject({ kind: "text", heading: "TO DO", level: 3 });
    expect(columns.cells[0]?.sections[0]?.kind === "text" ? columns.cells[0].sections[0].html : "").toContain("<li>gallery");
    expect(columns.cells[1]?.className).toBe("w3-teal");
    expect(columns.cells[1]?.sections[0]).toMatchObject({ kind: "text", heading: "DONE", level: 3 });
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
      {
        kind: "panel",
        tone: "pale-blue",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Gallery</p>" }],
      },
      { kind: "imgbox", src: "photo.jpg", alt: "Sheep", caption: "Open days", plain: false, width: "full" },
    ]);
  });
});

describe("markdown link round-trip", () => {
  it("restores a plain anchor to markdown and render turns it back", () => {
    const stored = `<p>See <a href="https://example.com/hall">Hall</a>.</p>`;
    const editing = restoreMarkdownLinks(stored);
    expect(editing).toContain("[Hall](https://example.com/hall)");
    expect(editing).not.toContain("<a ");
    expect(renderMarkdownLinks(editing)).toContain('<a href="https://example.com/hall">Hall</a>');
  });

  it("leaves javascript hrefs, extra attributes, and nested markup as anchors", () => {
    expect(restoreMarkdownLinks(`<p><a href="javascript:alert(1)">bad</a></p>`)).toContain("<a ");
    expect(restoreMarkdownLinks(`<p><a href="https://x.com" class="ext">Link</a></p>`)).toContain("<a ");
    expect(restoreMarkdownLinks(`<p><a href="https://x.com"><strong>Bold</strong></a></p>`)).toContain("<strong>");
  });
});

describe("paintSections", () => {
  it("turns a markdown link in HTML into an anchor and leaves javascript as text", () => {
    const html = paintSections([
      { kind: "html", html: `<p>See [Hall](https://example.com/hall) and [bad](javascript:alert(1)).</p>` },
    ]);
    expect(html).toContain('<a href="https://example.com/hall">Hall</a>');
    expect(html).toContain("[bad](javascript:alert(1))");
    expect(html).not.toContain("href=\"javascript:");
  });

  it("round-trips Super space on text sections", () => {
    const sections: Section[] = [{ kind: "text", heading: "", level: 2, html: "<p>Hi</p>", loose: true }];
    const html = paintSections(sections);
    expect(html).toContain("tessera-loose");
    expect(parseSections(html)).toEqual(sections);
  });

  it("leaves loose off text sections unpainted", () => {
    const sections: Section[] = [{ kind: "text", heading: "", level: 2, html: "<p>Hi</p>" }];
    const html = paintSections(sections);
    expect(html).not.toContain("tessera-loose");
  });

  it("round-trips heading level 4 on text and standalone headings", () => {
    const sections: Section[] = [
      { kind: "heading", level: 4, text: "Small title" },
      { kind: "text", heading: "Sub", level: 4, html: "<p>Body</p>" },
    ];
    const html = paintSections(sections);
    expect(html).toContain("<h4");
    expect(parseSections(html)).toEqual(sections);
  });

  it("keeps blank paragraph lines inside text html", () => {
    const html = `<div class="tessera-block tessera-text"><p><br></p><p>Hello</p></div>`;
    expect(parseSections(html)).toMatchObject([
      { kind: "text", heading: "", level: 2, html: "<p><br></p><p>Hello</p>" },
    ]);
  });

  it("paints and parses quote line breaks as br", () => {
    const sections = [{ kind: "quote" as const, tone: "sand" as const, text: "Line one\nLine two", attribution: "" }];
    const html = paintSections(sections);
    expect(html).toContain("Line one<br>Line two");
    expect(parseSections(html)).toEqual(sections);
  });

  it("round-trips a code block inside text html", () => {
    const sections = [
      {
        kind: "text" as const,
        heading: "",
        level: 2 as const,
        html: `<p>Intro.</p><pre class="tessera-pre">const x = 1;\nconsole.log(x);</pre><p>After.</p>`,
      },
    ];
    const html = paintSections(sections);
    expect(html).toContain('<pre class="tessera-pre">const x = 1;\nconsole.log(x);</pre>');
    expect(parseSections(html)).toEqual(sections);
  });

  it("rebuilds the same sections from painted HTML", () => {
    const sections: Section[] = [
      { kind: "heading", level: 2, text: "Hello" },
      {
        kind: "text",
        heading: "Notes",
        level: 3,
        html: "<p>A <strong>line</strong>.</p><ul><li>One</li><li>Two</li></ul>",
      },
      {
        kind: "panel",
        tone: "sand",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Note</p>" }],
      },
      { kind: "quote", tone: "pale", text: "Stay curious", attribution: "Ada" },
      { kind: "imgbox", src: "a.jpg", alt: "Alt", caption: "Caption", plain: false, width: "twothird" },
      {
        kind: "card",
        title: "Card",
        width: "full",
        plain: false,
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Body</p>" }],
      },
      {
        kind: "columns",
        layout: "1:1:1",
        cells: [
          { className: "w3-orange", sections: [{ kind: "heading", level: 3, text: "Left" }] },
          { className: "", sections: [{ kind: "text", heading: "", level: 2, html: "<p>Right</p>" }] },
          { className: "", sections: [] },
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
      {
        kind: "panel",
        tone: "theme",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Panel</p>" }],
      },
      { kind: "imgbox", src: "a.jpg", alt: "", caption: "Cap", plain: false, width: "full" },
      blankSection("columns"),
    ]);
    expect(html).toContain("w3-panel");
    expect(html).toContain("w3-sand");
    expect(html).toContain("tessera-quote-open");
    expect(html).toContain("w3-theme-l4");
    expect(html).toContain("w3-display-container");
    expect(html).toContain("tessera-imgbox");
    expect(html).toContain('src="a.jpg"');
    expect(html).toContain("w3-row-padding");
    expect(html).toContain("w3-half");
  });

  it("round-trips a site panel tone through paint and parse", () => {
    const tones = [{ id: "ma-blue", label: "School blue", className: "ma-panel-blue" }];
    const nested = { kind: "text" as const, heading: "", level: 2 as const, html: "<p>Schools</p>" };
    const sections = [{ kind: "panel" as const, tone: "ma-blue", sections: [nested] }];
    const html = paintSections(sections, tones);
    expect(html).toContain("ma-panel-blue");
    expect(html).toContain("rt-panel-body");
    expect(parseSections(html, tones)).toEqual(sections);
    // Without the catalog, keep the class as an opaque tone id.
    expect(parseSections(html)).toEqual([{ kind: "panel", tone: "ma-panel-blue", sections: [nested] }]);
    expect(paintSections(parseSections(html))).toContain("ma-panel-blue");
  });

  it("parses a legacy panel without rt-panel-body into nested text", () => {
    const html = `<div class="w3-panel w3-sand w3-padding"><p>Photos</p></div>`;
    expect(parseSections(html)).toEqual([
      {
        kind: "panel",
        tone: "sand",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Photos</p>" }],
      },
    ]);
  });

  it("drops the image frame and padding when asked so width applies to the raw image", () => {
    const plain = paintSections([{ kind: "imgbox", src: "a.jpg", alt: "Alt", caption: "Cap", plain: true, width: "half" }]);
    expect(plain).toMatch(/^<div class="tessera-block tessera-imgbox w3-display-container w3-center"/);
    expect(plain).not.toContain("w3-card");
    expect(plain).toContain('data-width="half"');
    expect(parseSections(plain)).toEqual([
      { kind: "imgbox", src: "a.jpg", alt: "Alt", caption: "Cap", plain: true, width: "half" },
    ]);
  });

  it("does not paint empty text, video, or card shells", () => {
    expect(paintSections([{ kind: "text", heading: "", level: 2, html: "" }])).toBe("");
    expect(paintSections([{ kind: "text", heading: "", level: 2, html: "<p><br></p>" }])).toBe("");
    expect(paintSections([{ kind: "youtube", videoId: "", title: "" }])).toBe("");
    expect(
      paintSections([
        {
          kind: "card",
          title: "",
          width: "full",
          plain: false,
          sections: [
            { kind: "text", heading: "", level: 2, html: "" },
            { kind: "youtube", videoId: "QvAdmE0vPW0", title: "Farm" },
          ],
        },
      ]),
    ).toContain("tessera-youtube");
    expect(
      paintSections([
        {
          kind: "card",
          title: "",
          width: "full",
          plain: false,
          sections: [{ kind: "text", heading: "", level: 2, html: "" }],
        },
      ]),
    ).toBe("");
    expect(parseSections(`<div class="tessera-block tessera-text"></div>`)).toEqual([]);
  });

  it("omits an empty card title and keeps the first body block flush", () => {
    const sections: Section[] = [
      {
        kind: "card",
        title: "",
        width: "twothird",
        plain: false,
        sections: [{ kind: "youtube", videoId: "QvAdmE0vPW0", title: "Farm" }],
      },
    ];
    const html = paintSections(sections);
    expect(html).not.toMatch(/<h3[^>]*>\s*<\/h3>/);
    expect(html).toContain("rt-card-body");
    expect(html).toContain('data-width="twothird"');
    expect(html).toContain("tessera-card");
    expect(parseSections(html)).toEqual(sections);
  });

  it("reads an older card body as sections inside the card", () => {
    const sections = parseSections(
      `<div class="w3-card w3-padding w3-margin-bottom w3-white"><h3 class="w3-text-theme">Card</h3><div class="rt-card-body"><p>Body</p></div></div>`,
    );
    expect(sections).toEqual([
      {
        kind: "card",
        title: "Card",
        width: "full",
        plain: false,
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Body</p>" }],
      },
    ]);
  });

  it("round-trips a card that holds text and side by side", () => {
    const sections: Section[] = [
      {
        kind: "card",
        title: "Visit",
        width: "full",
        plain: false,
        sections: [
          { kind: "text", heading: "Hours", level: 2, html: "<p>Open at nine.</p>" },
          {
            kind: "columns",
            layout: "2:1",
            cells: [
              { className: "", sections: [{ kind: "text", heading: "", level: 2, html: "<p>Wide</p>" }] },
              { className: "", sections: [{ kind: "text", heading: "", level: 2, html: "<p>Narrow</p>" }] },
            ],
          },
        ],
      },
    ];
    const html = paintSections(sections);
    expect(html).toContain("w3-twothird");
    expect(html).toContain("w3-third");
    expect(parseSections(html)).toEqual(sections);
  });

  it("paints a plain sized card and nested sized cards keep their own data-width", () => {
    const sections: Section[] = [
      {
        kind: "card",
        title: "Outer",
        width: "twothird",
        plain: true,
        sections: [
          {
            kind: "card",
            title: "Inner",
            width: "twothird",
            plain: false,
            sections: [{ kind: "youtube", videoId: "QvAdmE0vPW0", title: "Farm" }],
          },
        ],
      },
    ];
    const html = paintSections(sections);
    expect(html).toContain('class="tessera-block tessera-card" data-width="twothird"');
    expect(html).toContain('class="tessera-block tessera-card w3-card w3-padding w3-white" data-width="twothird"');
    expect(html.match(/data-width="twothird"/g)?.length).toBe(2);
    expect(parseSections(html)).toEqual(sections);
  });

  it("paints each side-by-side ratio with the matching W3 classes", () => {
    const cases: { layout: ColumnLayoutId; widths: string[] }[] = [
      { layout: "1:1", widths: ["w3-half", "w3-half"] },
      { layout: "2:1", widths: ["w3-twothird", "w3-third"] },
      { layout: "1:2", widths: ["w3-third", "w3-twothird"] },
      { layout: "1:1:1", widths: ["w3-third", "w3-third", "w3-third"] },
      { layout: "1:2:1", widths: ["w3-quarter", "w3-half", "w3-quarter"] },
      { layout: "1:1:1:1", widths: ["w3-quarter", "w3-quarter", "w3-quarter", "w3-quarter"] },
    ];
    for (const item of cases) {
      const section: Section = {
        kind: "columns",
        layout: item.layout,
        cells: item.widths.map(() => ({ className: "", sections: [] })),
      };
      const html = paintSections([section]);
      const classes = [...html.matchAll(/class="([^"]+)"/g)].map((match) => match[1]);
      expect(classes.slice(1)).toEqual(item.widths);
      expect(parseSections(html)).toEqual([section]);
    }
  });

  it("leaves a binding token in the painted HTML", () => {
    expect(paintSections([{ kind: "insert", id: "people-preview" }])).toBe("{{people-preview}}");
  });

  it("paints and parses a table of contents marker", () => {
    const html = paintSections([{ kind: "toc" }]);
    expect(html).toContain('data-tessera="toc"');
    expect(parseSections(html)).toEqual([{ kind: "toc" }]);
  });

  it("paints and parses a spacer with default em height", () => {
    expect(blankSection("spacer")).toEqual({ kind: "spacer", value: 1, unit: "em" });
    const sections = [{ kind: "spacer" as const, value: 1, unit: "em" as const }];
    const html = paintSections(sections);
    expect(html).toContain("tessera-spacer");
    expect(html).toContain('data-height="1"');
    expect(html).toContain('data-unit="em"');
    expect(html).toContain('style="height:1em"');
    expect(parseSections(html)).toEqual(sections);
  });

  it("round-trips spacer units and falls back for invalid height", () => {
    const sections = [{ kind: "spacer" as const, value: 2.5, unit: "rem" as const }];
    const html = paintSections(sections);
    expect(parseSections(html)).toEqual(sections);
    expect(
      parseSections(
        `<div class="tessera-block tessera-spacer" style="height: 3px" aria-hidden="true"></div>`,
      ),
    ).toEqual([{ kind: "spacer", value: 3, unit: "px" }]);
    expect(
      parseSections(
        `<div class="tessera-block tessera-spacer" data-height="0" data-unit="px" style="height:0px"></div>`,
      ),
    ).toEqual([{ kind: "spacer", value: 1, unit: "px" }]);
  });

  it("round-trips subpages with an optional tone", () => {
    const sections = [{ kind: "subpages" as const, title: "In this section", tone: "sand" as const }];
    const html = paintSections(sections);
    expect(html).toContain('data-tone="sand"');
    expect(html).toContain("w3-sand");
    expect(parseSections(html)).toEqual(sections);
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
    expect(html).toContain("tessera-youtube");
    expect(html).not.toContain("data-width");
    expect(html).toContain("tessera-video");
    expect(html).toContain('data-tessera="gallery"');
    expect(html).toContain('data-mode="grid"');
    expect(html).toContain("tessera-pasted-sheet");
    expect(html).toContain("<p>Author text</p>");
    expect(html).not.toContain("BABIES");
  });

  it("reads legacy YouTube markup and ignores leftover data-width", () => {
    const legacy = parseSections(
      `<div class="tessera-block tessera-video w3-card"><iframe src="https://www.youtube-nocookie.com/embed/QvAdmE0vPW0" title="Farm"></iframe></div>`,
    );
    expect(legacy).toEqual([{ kind: "youtube", videoId: "QvAdmE0vPW0", title: "Farm" }]);
    const sized = parseSections(
      `<div class="tessera-block tessera-youtube" data-width="half"><div class="tessera-video"><iframe src="https://www.youtube-nocookie.com/embed/QvAdmE0vPW0" title="Farm"></iframe></div></div>`,
    );
    expect(sized).toEqual([{ kind: "youtube", videoId: "QvAdmE0vPW0", title: "Farm" }]);
    const painted = paintSections(sized);
    expect(painted).not.toContain("data-width");
    expect(painted).not.toContain("w3-card");
  });

  it("reads a YouTube id from a watch, share, or embed address", () => {
    expect(youtubeVideoId("QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube.com/watch?v=QvAdmE0vPW0&t=12")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://youtu.be/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube-nocookie.com/embed/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("https://www.youtube.com/shorts/QvAdmE0vPW0")).toBe("QvAdmE0vPW0");
    expect(youtubeVideoId("not a video")).toBe("");
  });

  it("keeps a heading on the text run and leaves a heading that introduces a panel", () => {
    const sections = parseSections(
      `<h2>Market</h2><p>Opens at nine.</p><ul><li>Bread</li></ul><p>Closes at one.</p><h2>Gallery</h2><div class="w3-panel w3-sand w3-padding"><p>Photos</p></div>`,
    );
    expect(sections).toEqual([
      {
        kind: "text",
        heading: "Market",
        level: 2,
        html: "<p>Opens at nine.</p><ul><li>Bread</li></ul><p>Closes at one.</p>",
      },
      { kind: "heading", level: 2, text: "Gallery" },
      {
        kind: "panel",
        tone: "sand",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Photos</p>" }],
      },
    ]);
    expect(parseSections(paintSections(sections))).toEqual(sections);
  });

  it("keeps a binding between paragraphs as its own item", () => {
    const sections = parseSections(`<p>Before</p><p>{{people-preview}}</p><p>After</p>`);
    expect(sections.map((section) => section.kind)).toEqual(["text", "insert", "text"]);
    expect(sections[1]).toEqual({ kind: "insert", id: "people-preview" });
  });

  it("leaves an old tilted farm block as custom HTML", () => {
    const html = `<div style="margin: 30px auto; padding: 40px; transform: rotate(-2deg);">Farm news stays here.</div>`;
    expect(parseSections(html)).toEqual([{ kind: "html", html }]);
  });

  it("round-trips card and imgbox frame colours", () => {
    const sections: Section[] = [
      {
        kind: "card",
        title: "Dark",
        width: "full",
        plain: false,
        frameColor: "rgba(0, 0, 0, 0.6)",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Body</p>" }],
      },
      {
        kind: "imgbox",
        src: "a.jpg",
        alt: "",
        caption: "",
        plain: false,
        width: "half",
        frameColor: "#1a1a1a",
      },
    ];
    const html = paintSections(sections);
    expect(html).toContain("--tessera-frame-bg");
    expect(html).toContain("rgba(0, 0, 0, 0.6)");
    expect(parseSections(html)).toEqual(sections);
  });

  it("does not paint frame colour when the frame is hidden", () => {
    const html = paintSections([
      {
        kind: "card",
        title: "Plain",
        width: "full",
        plain: true,
        frameColor: "rgba(0, 0, 0, 0.6)",
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Body</p>" }],
      },
    ]);
    expect(html).not.toContain("--tessera-frame-bg");
  });

  it("drops invalid frame colours on parse", () => {
    const html = `<div class="tessera-block tessera-card w3-card w3-padding w3-white" style="--tessera-frame-bg: url(javascript:alert(1))"><div class="rt-card-body"><p>Body</p></div></div>`;
    expect(parseSections(html)).toEqual([
      {
        kind: "card",
        title: "",
        width: "full",
        plain: false,
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Body</p>" }],
      },
    ]);
  });
});
