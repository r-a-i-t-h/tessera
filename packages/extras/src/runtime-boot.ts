import type { RuntimeModuleMountSpec } from "./runtime-module-present.js";
import {
  createRuntimeModuleHost,
  type RuntimeModuleMount,
  type RuntimeModuleMountContext,
} from "./runtime-host.js";
import { isValidRuntimeModulePublicUrl } from "./runtime-module-url.js";

const BOOTED = "tessera-runtime-module-booted";

function readSpec(mountRoot: HTMLElement): RuntimeModuleMountSpec | undefined {
  const script = mountRoot.querySelector('script[type="application/json"]');
  if (!script?.textContent) return undefined;
  try {
    const parsed = JSON.parse(script.textContent) as RuntimeModuleMountSpec;
    if (parsed?.v !== 1 || typeof parsed.module !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function resolveImportUrl(relative: string): string {
  return new URL(relative.replace(/^\.\//, ""), document.baseURI).href;
}

async function bootOne(mountRoot: HTMLElement): Promise<void> {
  if (mountRoot.classList.contains(BOOTED)) return;
  const spec = readSpec(mountRoot);
  const moduleAttr = mountRoot.dataset.module ?? spec?.module ?? "";
  const moduleUrl = moduleAttr.trim();
  if (!isValidRuntimeModulePublicUrl(moduleUrl)) {
    console.error("[tessera] invalid runtime module URL", moduleUrl);
    return;
  }
  const importUrl = resolveImportUrl(moduleUrl);
  try {
    const mod = await import(/* @vite-ignore */ importUrl);
    const mountFn = mod.default as RuntimeModuleMount;
    if (typeof mountFn !== "function") {
      console.error("[tessera] runtime module has no default export function", moduleUrl);
      return;
    }
    const helper = createRuntimeModuleHost(mountRoot);
    const ctx: RuntimeModuleMountContext = {
      props: spec?.props ?? {},
      ...(spec?.dataset ? { dataset: spec.dataset as RuntimeModuleMountContext["dataset"] } : {}),
      host: helper,
    };
    mountRoot.classList.add(BOOTED);
    await mountFn(mountRoot, ctx);
  } catch (err) {
    console.error("[tessera] runtime module failed to load", moduleUrl, err);
  }
}

/** Load and mount owner runtime modules in the published page. */
export function bootRuntimeModules(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".tessera-runtime-module-mount").forEach((el) => {
    void bootOne(el);
  });
}
