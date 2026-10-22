import { describe, expect, it } from "vitest";
import { expandToc } from "../toc.js";

describe("expandToc", () => {
  it("lists only headings after the marker with relative indentation", () => {
    const html = [
      '<h2 class="tessera-block">Intro</h2>',
      '<nav class="tessera-block tessera-toc" data-tessera="toc"></nav>',
      '<h2 class="tessera-block">Animals</h2>',
      '<div class="tessera-block tessera-text"><h3>Goats</h3><p>Playful.</p></div>',
      '<h4 class="tessera-block">Feed</h4>',
    ].join("\n");

    const out = expandToc(html);
    const nav = out.match(/<nav class="tessera-block tessera-toc"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toContain("Intro");
    expect(out).toContain('href="#animals"');
    expect(out).toContain("Animals");
    expect(out).toContain('href="#goats"');
    expect(out).toContain('class="tessera-toc-indent-1"');
    expect(out).toContain('id="animals"');
    expect(out).toContain('id="goats"');
    expect(out).toContain('id="feed"');
    expect(out).not.toContain('data-tessera="toc"');
  });

  it("ignores card titles and empty headings", () => {
    const html = [
      '<nav class="tessera-block tessera-toc" data-tessera="toc"></nav>',
      '<div class="tessera-block tessera-card w3-card"><h3 class="w3-text-theme">Card title</h3></div>',
      '<h2 class="tessera-block">Real section</h2>',
      '<h2 class="tessera-block">   </h2>',
    ].join("\n");

    const out = expandToc(html);
    const nav = out.match(/<nav class="tessera-block tessera-toc"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toContain("Card title");
    expect(nav).toContain("Real section");
    expect(out).not.toContain('href="#"');
  });
});
