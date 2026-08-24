# Tessera

Lightweight, client-side site runtime: **layouts declare zones**, **content fills them**, **components are TypeScript the site imports**. One flattened JSON file holds the whole text/data payload.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the model, and `apps/demo-pure` for a working demo.

## Quick start

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Packages

| Package | Path |
|---------|------|
| `@r-a-i-t-h/tessera-model` | `packages/model` |
| `@r-a-i-t-h/tessera-renderer` | `packages/renderer` |
| `@r-a-i-t-h/tessera-skin-w3` | `packages/skin-w3` |
| `@r-a-i-t-h/tessera-wc-base` | `packages/wc-base` |
| `@r-a-i-t-h/tessera-demo-pure` | `apps/demo-pure` |

## Legacy

The original RecTem engine (`js/rectem-*.js`) and demos (`demo-ineffable`, `demo-millersark`, `demo-pure-rectem`) remain for reference. New work targets Tessera above.
