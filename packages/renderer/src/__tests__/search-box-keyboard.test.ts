import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootSearch } from "../builtins/search.js";
import { searchIndexPayload } from "../search-index.js";
import { makeFixtureDoc } from "./fixtures.js";

function mountSearchBox(indexUrl: string): {
  host: HTMLElement;
  input: HTMLInputElement;
  suggest: HTMLElement;
} {
  document.body.innerHTML = `
    <div class="tessera-search tessera-search-box" data-tessera-search="box"
      data-search-index="${indexUrl}"
      data-search-results-page="search"
      data-search-results-href="#search">
      <label class="tessera-search-label w3-hide">Search</label>
      <input type="search" class="w3-input w3-border tessera-search-input" placeholder="Search…" autocomplete="off" enterkeyhint="search" aria-label="Search" role="combobox" aria-autocomplete="list" aria-expanded="false" />
      <ul class="tessera-search-suggest w3-ul w3-card w3-white" hidden role="listbox"></ul>
    </div>`;
  const host = document.querySelector<HTMLElement>("[data-tessera-search='box']")!;
  const input = host.querySelector<HTMLInputElement>(".tessera-search-input")!;
  const suggest = host.querySelector<HTMLElement>(".tessera-search-suggest")!;
  return { host, input, suggest };
}

async function waitForOptions(suggest: HTMLElement, min = 1): Promise<NodeListOf<HTMLElement>> {
  for (let i = 0; i < 40; i++) {
    const options = suggest.querySelectorAll<HTMLElement>('[role="option"]');
    if (!suggest.hidden && options.length >= min) return options;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Suggest options did not appear");
}

describe("search box keyboard", () => {
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignSpy = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
      href: "http://localhost/",
      hash: "",
      search: "",
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ArrowDown highlights the first option; Enter navigates its href", async () => {
    const payload = searchIndexPayload(makeFixtureDoc());
    const indexUrl = `./search-index-kb-${Math.random().toString(36).slice(2)}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes(indexUrl.replace("./", ""))) {
          return {
            ok: true,
            json: async () => payload,
          };
        }
        return { ok: false, json: async () => null };
      }),
    );

    const { input, suggest } = mountSearchBox(indexUrl);
    bootSearch(document);

    input.focus();
    input.value = "home";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const options = await waitForOptions(suggest, 1);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    const href = options[0].querySelector("a")!.getAttribute("href")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(assignSpy).toHaveBeenCalledWith(href);
  });

  it("Enter with no highlight goes to full results page", async () => {
    const payload = searchIndexPayload(makeFixtureDoc());
    const indexUrl = `./search-index-kb-${Math.random().toString(36).slice(2)}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      })),
    );

    const { input, suggest } = mountSearchBox(indexUrl);
    bootSearch(document);

    input.value = "home";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitForOptions(suggest, 1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(assignSpy).toHaveBeenCalledWith("#search?q=home");
  });

  it("Slash focuses the search box when it is on screen and focus is elsewhere", () => {
    const { host, input } = mountSearchBox("./search-index-kb-slash.json");
    Object.defineProperty(host, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 10,
        left: 10,
        bottom: 50,
        right: 200,
        width: 190,
        height: 40,
      }),
    });
    bootSearch(document);

    const other = document.createElement("button");
    other.type = "button";
    other.textContent = "Elsewhere";
    document.body.appendChild(other);
    other.focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(document.activeElement).toBe(input);
  });

  it("Slash does not steal focus from another text field", () => {
    const { host } = mountSearchBox("./search-index-kb-slash2.json");
    Object.defineProperty(host, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 10,
        left: 10,
        bottom: 50,
        right: 200,
        width: 190,
        height: 40,
      }),
    });
    bootSearch(document);

    const field = document.createElement("input");
    field.type = "text";
    document.body.appendChild(field);
    field.focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(document.activeElement).toBe(field);
  });

  it("ArrowUp from the first option clears the highlight", async () => {
    const payload = searchIndexPayload(makeFixtureDoc());
    const indexUrl = `./search-index-kb-${Math.random().toString(36).slice(2)}.json`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      })),
    );

    const { input, suggest } = mountSearchBox(indexUrl);
    bootSearch(document);

    input.value = "home";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const options = await waitForOptions(suggest, 1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(options[0].getAttribute("aria-selected")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  });
});
