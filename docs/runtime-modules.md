# Runtime modules

Runtime modules are **client-only** JavaScript served from `./runtime-modules/` on your published site. Tessera stores and copies the files; it **never executes** module code on the server. The site runtime `import()`s each module and calls `export default function mount(root, ctx)`.

## Authoring

1. Build an ES module with a default `mount` export (see `examples/runtime-module/plain-list/demo-plain-list.mjs`).
2. Upload via **Runtime modules** in the editor (or copy into `data/runtime-modules/`).
3. Create a **binding** — **Runtime module** (props only) or **Dataset list** with presentation **Runtime module**.
4. Insert the binding in Compose, render preview, publish.

Use `ctx.host` for DOM helpers (`el`, `text`, `ui.card`, `ui.panel`, `ui.imgBox`, `ui.heading`, `ui.text`) — do not import from `tessera.js` in v1.

## Contract

```js
export default async function mount(root, ctx) {
  // root — mount element (.tessera-runtime-module-mount); ctx.host.root === root
  // ctx.props — binding props
  // ctx.dataset — optional dataset payload (dataset bindings)
  // ctx.host — RuntimeModuleHost helpers (el, text, ui.*)
}
```

Modules must be served from `./runtime-modules/<id>.js` or `.mjs` on the same origin as the page.
