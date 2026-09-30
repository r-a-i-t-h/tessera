import { describe, expect, it } from "vitest";
import { styleDraft, styleFieldValues, styleFromValues } from "./style.js";

describe("style form", () => {
  it("fills defaults when the site has no style", () => {
    const values = styleFieldValues({ title: "New site" });
    expect(values.sidebarWidth).toBe("300px");
    expect(values.fontA).toBe("Lekton");
    expect(values.navSide).toBe("right");
    expect(values.bar).toBe("#009688");
  });

  it("keeps a valid draft and rejects a bad length", () => {
    const saved = styleFromValues({ sidebarWidth: "260px", navSide: "left", bar: "#abcdef" });
    expect(saved).toEqual({ ok: true, style: { sidebarWidth: "260px", navSide: "left", bar: "#abcdef" } });
    const rejected = styleFromValues({ sidebarWidth: "wide" });
    expect(rejected.ok).toBe(false);
    expect(styleDraft({ fontA: "Roboto" }).fontA).toBe("Roboto");
  });
});