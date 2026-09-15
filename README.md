# Tessera

Client-side site runtime that renders an entire small website from one validated JSON document plus a site-owned component registry — **layouts declare zones**, **content fills them**, **components are TypeScript the site imports**.

| Doc | Role |
|-----|------|
| [SPEC.md](./SPEC.md) | Product + architecture: goals, design decisions, acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-built engine contract (packages, pipeline, Zod) |
| [ROADMAP.md](./ROADMAP.md) | Sequenced upcoming features |

## Quick start

```bash
npm install
npm run dev                 # pure demo (port 5173)
npm run dev:ineffable       # ineffable port (5174)
npm run dev:millersark      # Miller's Ark port (5175)
npm run dev:willow          # Willow Hall community demo (5176)
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
| `@r-a-i-t-h/tessera-demo-kit` | `packages/demo-kit` (fonts, nav chrome, w3 helpers) |

## Demo apps

| App | Notes |
|-----|--------|
| `apps/demo-pure` | Engine lab: zones, components, font switch |
| `apps/demo-ineffable` | Port of the personal site (layouts, fonts, W3 chrome) |
| `apps/demo-millersark` | Port of Miller's Ark CMS content + `openDaysTable` |
| `apps/demo-willow` | Content showcase: news, events, weekly meetings, people, gallery |

Legacy RecTem sources can be re-converted with `npm run convert:legacy` (needs a local `.ref-legacy/` checkout).

## Migration scripts

[`ps/`](./ps/) holds PowerShell helpers from the PurpleCMS → site-data era. They still target the old RecTem shapes and will be rewritten for Tessera’s `SiteDocument` later.
