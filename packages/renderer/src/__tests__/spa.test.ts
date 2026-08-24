import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentRegistry, SiteRenderer } from "../index.js";
import { makeFixtureDoc } from "./fixtures.js";

function buildRegistry() {
  const registry = new ComponentRegistry();
  registry.define("greet", () => "greet");
  registry.define("eventList", () => "events");
  return registry;
}

describe("SiteRenderer navigation", () => {
  let mount: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    mount = document.getElementById("app")!;
    window.location.hash = "";
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the home page by default and calls onAfterRender", async () => {
    const after: string[] = [];
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
      onAfterRender: (id) => after.push(id),
    });
    renderer.start();
    expect(mount.innerHTML).toContain("Home title");
    expect(after).toEqual(["home"]);
  });

  it("navigates on hashchange", async () => {
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();
    expect(mount.innerHTML).toContain("Home title");

    window.location.hash = "#about";
    window.dispatchEvent(new Event("hashchange"));

    expect(mount.innerHTML).toContain("About body");
    expect(mount.innerHTML).not.toContain("Home title");
  });

  it("render(pageId) overrides the hash", async () => {
    window.location.hash = "#home";
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();
    renderer.render("hidden-aside");
    expect(mount.innerHTML).toContain("No aside layout");
    expect(mount.innerHTML).not.toContain("Should not show");
  });

  it("loads a document from a relative URL", async () => {
    const doc = makeFixtureDoc();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(doc), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const renderer = await SiteRenderer.create({
      documentUrl: "./data/site.json",
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();

    expect(fetchMock).toHaveBeenCalledWith("./data/site.json");
    expect(mount.innerHTML).toContain("Home title");
  });
});
