/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"http://localhost/#/content/home"}
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecordList, RecordPayload } from "./api.js";
import { mount } from "./app.js";

const listing: RecordList = {
  ok: true,
  kinds: [
    { kind: "site", label: "Site" },
    { kind: "nav", label: "Navigation" },
    { kind: "content", label: "Pages" },
    { kind: "templates", label: "Templates" },
    { kind: "bindings", label: "Bindings" },
    { kind: "items", label: "Items" },
    { kind: "types", label: "Types" },
    { kind: "layouts", label: "Layouts" },
  ],
  records: [
    { kind: "site", id: "demo", title: "Demo" },
    { kind: "content", id: "home", title: "Home" },
  ],
};

const home: RecordPayload = {
  ok: true,
  kind: "content",
  id: "home",
  data: {
    id: "home",
    title: "Home",
    zones: { main: { html: "<p>Saved body</p>" } },
  },
  raw: "id: home\ntitle: Home\nzones:\n  main:\n    html: <p>Saved body</p>\n",
  file: "content/home.yaml",
  historyFile: "history/content/home.history",
  schemaVersion: 2,
  history: [],
  layout: {
    layoutId: "page",
    layoutSource: "site",
    fields: [],
    declaredZones: ["main"],
    offLayoutZones: [],
    layouts: { page: { zones: ["main"] } },
    frames: [],
  },
};

const site: RecordPayload = {
  ok: true,
  kind: "site",
  id: "demo",
  data: {
    id: "demo",
    title: "Demo",
    homePageId: "home",
    defaultLayoutId: "page",
    delivery: "pages",
  },
  raw: "id: demo\ntitle: Demo\nhomePageId: home\ndefaultLayoutId: page\ndelivery: pages\n",
  file: "site.yaml",
  schemaVersion: 2,
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function navigate(hash: string): void {
  window.location.hash = hash;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("editor route orchestration", () => {
  it("keeps a content draft across modes, discards it after leaving, and embeds the site editor", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/auth/me") {
        return json({ ok: true, username: "alice", createdAt: "2026-01-01T00:00:00.000Z" });
      }
      if (path === "/api/records") return json(listing);
      if (path === "/api/records/content/home") return json(home);
      if (path === "/api/records/site/demo") return json(site);
      if (path === "/api/library") return json({ ok: true, folders: [], assets: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) throw new Error("app");

    await mount(root);
    await vi.waitFor(() => {
      expect(root.querySelector("[data-mode=compose]")?.classList.contains("w3-theme")).toBe(true);
      expect(root.querySelector("[data-mode=compose]")?.getAttribute("aria-pressed")).toBe("true");
      expect(root.querySelector('[role="toolbar"][aria-label="Editing mode"]')).toBeTruthy();
    });
    expect(root.querySelector('a[href="#/pages"]')?.getAttribute("aria-current")).toBe("page");
    expect(root.querySelector('a[href="#/records"]')?.hasAttribute("aria-current")).toBe(false);
    expect(root.querySelector(".editor-back")?.getAttribute("href")).toBe("#/pages");
    expect(root.querySelector("h1")?.textContent).toBe("Home");

    root
      .querySelector<HTMLButtonElement>("[data-mode=fields]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector("[data-mode=fields]")?.classList.contains("w3-theme")).toBe(true);
      expect(root.querySelector("[data-mode=fields]")?.getAttribute("aria-pressed")).toBe("true");
      expect(root.querySelector("[data-mode=compose]")?.getAttribute("aria-pressed")).toBe("false");
    });
    const title = root.querySelector<HTMLInputElement>("#f-title");
    if (!title) throw new Error("title");
    title.value = "Unsaved title";
    title.dispatchEvent(new Event("input", { bubbles: true }));

    root.querySelector<HTMLButtonElement>("[data-mode=raw]")?.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLTextAreaElement>("#raw-file")?.value).toContain(
        "title: Unsaved title",
      );
    });

    root.querySelector<HTMLButtonElement>("[data-mode=fields]")?.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLInputElement>("#f-title")?.value).toBe("Unsaved title");
    });

    navigate("#/");
    await vi.waitFor(() => {
      expect(root.querySelector("h1")?.textContent).toBe("Tessera editor");
    });
    navigate("#/content/home");
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLInputElement>("#f-title")?.value).toBe("Home");
    });

    navigate("#/records/site");
    await vi.waitFor(() => {
      expect(root.querySelector("#record-editor #record-form")).toBeTruthy();
    });
    expect(root.querySelector("#record-editor")?.getAttribute("data-kind")).toBe("site");
    expect(root.querySelector(".editor-back")).toBeNull();
    expect(root.querySelector<HTMLInputElement>("#record-editor #f-title")?.value).toBe("Demo");
  });

  it("opens an HTML zone in an editor and offers a new item", async () => {
    const itemListing: RecordList = {
      ...listing,
      records: [
        { kind: "site", id: "demo", title: "Demo" },
        { kind: "items", id: "common-footer" },
      ],
    };
    const footer: RecordPayload = {
      ok: true,
      kind: "items",
      id: "common-footer",
      data: {
        id: "common-footer",
        zones: {
          footer: { html: "<p>New site</p>" },
          events: { json: [{ title: "Fair" }] },
        },
      },
      raw: "id: common-footer\n",
      file: "items/common-footer.yaml",
      schemaVersion: 2,
      history: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/auth/me") {
        return json({ ok: true, username: "alice", createdAt: "2026-01-01T00:00:00.000Z" });
      }
      if (path === "/api/records") return json(itemListing);
      if (path === "/api/records/items/common-footer") return json(footer);
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) throw new Error("app");
    navigate("#/records/items");

    await mount(root);
    await vi.waitFor(() => {
      expect(root.querySelector("[data-action=new-item]")?.textContent).toBe("New item");
    });
    expect(root.textContent).toContain("HTML, JSON, a component, or a block list");

    root.querySelector<HTMLButtonElement>("[data-action=new-item]")?.click();
    const form = root.querySelector<HTMLFormElement>("#new-item-form");
    expect(form?.hidden).toBe(false);
    expect(form?.querySelector("#new-item-zone")).toBeTruthy();
    expect(form?.querySelector("#new-item-content")?.textContent).toContain("Component");
    expect(form?.querySelector("#new-item-content")?.textContent).toContain("Blocks");

    navigate("#/items/common-footer");
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLTextAreaElement>('[name="zones.footer.html"]')?.value).toBe("<p>New site</p>");
    });
    const htmlBox = root.querySelector<HTMLTextAreaElement>('[name="zones.footer.html"]');
    expect(htmlBox?.getAttribute("data-kind")).toBeNull();
    expect(htmlBox?.closest("p")?.textContent).toContain("Footer HTML");
    expect(root.querySelector('[name="zones"]')).toBeNull();
    const jsonBox = root.querySelector<HTMLTextAreaElement>('[name="zones.events.json"]');
    expect(jsonBox?.getAttribute("data-kind")).toBe("json");
    expect(jsonBox?.value).toBe(`[
  {
    "title": "Fair"
  }
]`);
    expect(root.querySelector("[data-json-format]")?.textContent).toBe("Pretty-print");
  });
});
