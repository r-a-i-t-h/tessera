import { describe, expect, it } from "vitest";
import { parseSiteDocument } from "../index.js";
import { resolveSiteStyle, siteBodyClass, siteStyleCss, styleIssue } from "../style.js";

const layout = {
  id: "L",
  root: { type: "region" as const, children: [{ type: "zone" as const, id: "main" }] },
};
const page = {
  id: "p1",
  title: "P",
  layoutId: "L",
  zones: { main: [{ type: "text" as const, html: "hi" }] },
};

describe("site style", () => {
  it("keeps a partial style object and fills the other tokens", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: {
        id: "s",
        title: "S",
        homePageId: "p1",
        style: { sidebarWidth: "240px", bar: "#112233" },
      },
      layouts: [layout],
      pages: [page],
    });
    expect(doc.site.style).toEqual({ sidebarWidth: "240px", bar: "#112233" });
    const resolved = resolveSiteStyle(doc.site.style);
    expect(resolved.sidebarWidth).toBe("240px");
    expect(resolved.bar).toBe("#112233");
    expect(resolved.barHeight).toBe("42px");
    expect(resolved.fontA).toBe("Lekton");
    expect(resolved.navSide).toBe("right");
    expect(siteStyleCss(doc.site.style)).toContain("--tessera-sidebar-width: 240px;");
    expect(siteStyleCss(doc.site.style)).toContain("--tessera-bar-height: 42px;");
    expect(siteBodyClass(doc.site.style)).toBe("rightnav fontA");
    expect(siteBodyClass({ navSide: "left" })).toBe("leftnav fontA");
  });

  it("rejects unsafe tokens and falls back when emitting CSS", () => {
    expect(styleIssue({ sidebarWidth: "240px; color: red" })).toMatch(/Sidebar width/);
    expect(styleIssue({ fontsHref: "javascript:alert(1)" })).toMatch(/https/);
    const css = siteStyleCss({
      sidebarWidth: "240px; color: red",
      fontA: "</style>",
      bar: "red",
    });
    expect(css).toContain("--tessera-sidebar-width: 300px;");
    expect(css).toContain('--tessera-font-a: "Lekton", sans-serif;');
    expect(css).toContain("--tessera-bar: #009688;");
    expect(css).not.toContain("</style>");
  });
});
