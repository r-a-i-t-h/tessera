import { parseSiteDocument, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  ComponentRegistry,
  createDefaultRegistry,
  escapeHtml,
  type MicroAppMount,
  type RenderContext,
} from "@r-a-i-t-h/tessera-renderer";
import { installChromeGlobals } from "@r-a-i-t-h/tessera-demo-kit";
import { registerExtras } from "@r-a-i-t-h/tessera-extras";

installChromeGlobals();

const stubDocument: SiteDocument = parseSiteDocument({
  version: 2,
  site: { id: "mount", title: "Mount", homePageId: "mount" },
  layouts: [{ id: "bare", root: { type: "region", children: [{ type: "page" }] } }],
  pages: [{ id: "mount", title: "Mount", zones: {} }],
});

function mountContext(registry: ComponentRegistry, mount: MicroAppMount): RenderContext {
  const fromZone = mount.fromZone ?? "data";
  const zones = new Map<string, import("@r-a-i-t-h/tessera-model").Block[]>();
  if (mount.data) zones.set(fromZone, [{ type: "json", data: mount.data }]);
  return {
    document: stubDocument,
    page: stubDocument.pages[0]!,
    profile: { layoutId: "bare", layoutSource: "site" },
    zones,
    registry,
    renderBlocks: () => "",
    zoneJson: <T = unknown>(zoneId: string) => (zoneId === fromZone ? ((mount.data ?? []) as T[]) : []),
    mediaHtml: () => "",
    escapeHtml,
  };
}

function renderMount(registry: ComponentRegistry, mount: MicroAppMount): string {
  const props = {
    ...(mount.props ?? {}),
    ...(mount.fromZone ? { fromZone: mount.fromZone } : {}),
  };
  return registry.render(mount.component, mountContext(registry, mount), props);
}

/** Fill leftover micro-app mounts. Static HTML from the pages dist stays put. */
function hydrate(): void {
  const registry = createDefaultRegistry(registerExtras);

  const script = document.getElementById("tessera-microapps");
  if (!script?.textContent) return;
  let mounts: MicroAppMount[] = [];
  try {
    const parsed = JSON.parse(script.textContent) as unknown;
    if (!Array.isArray(parsed)) return;
    mounts = parsed as MicroAppMount[];
  } catch {
    return;
  }
  for (const mount of mounts) {
    if (!mount || typeof mount.id !== "string") continue;
    const selector = `[data-tessera-microapp="${cssEscape(mount.id)}"]`;
    const host = document.querySelector(selector);
    if (!host) continue;
    const html = renderMount(registry, mount);
    if (!html || html.startsWith("<!--")) continue;
    host.innerHTML = html;
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

hydrate();
