# Tessera project assessment

Assessment date: 6 October 2026  
Assessed version: 0.2.7

## Executive assessment

Tessera already succeeds as a focused small-site content management system. It can take a site from editable YAML records to a portable static website, offers both a browser-rendered snapshot and pre-rendered pages, includes a usable editor, and keeps the public site independent of the editor process. Its core design is coherent and unusually well documented for a project at version 0.2.x.

The main risk is no longer whether the rendering model works. It does. The main risks are that the editor and file-writing code are becoming harder to change safely:

- most editor orchestration lives in one very large `apps/editor/src/app.ts` file;
- media-library mutations use a second, weaker write path instead of the rollback path used by normal records;
- authored records are only fully validated when Tessera rebuilds the whole site;
- important editor navigation and save orchestration have less test coverage than lower-level form helpers;
- releases have automation, but pull requests do not have a CI quality gate;
- a few security and deployment defaults are safe only when operators understand Tessera's trusted, small-team assumptions.

These are manageable problems. They do not require a rewrite or a new framework. The best course is to strengthen tests and data-integrity boundaries first, remove small duplication next, then split the editor and back end along boundaries that already exist in the code.

Overall rating: **3.8 out of 5**.

This score means “a strong, coherent early product with a credible production path for its intended niche, but with maintainability, author experience, and operational safeguards still below established CMS products.”

## Scope and method

This assessment treats the following documents as the product contract:

- [`SPEC.md`](./SPEC.md), especially the goals, non-goals, and acceptance criteria;
- [`ROADMAP.md`](./ROADMAP.md), which states the current product position and planned work;
- [`ARCHITECTURE.md`](./ARCHITECTURE.md), which describes the implementation contract;
- [`README.md`](./README.md), which describes setup, editing, publishing, backup, and deployment.

The review covered the editor, editor API, model, renderer, sections, site runtime, build and release configuration, tests, migrations, reference site, and deployment scripts. Competitive comparisons use the products' current public documentation and compare feature shape rather than popularity or market share.

Ratings use this scale:

- **5 — excellent:** achieves the stated goal with mature safeguards and little important debt;
- **4 — strong:** achieves the goal, with bounded gaps;
- **3 — adequate:** usable, but important work remains;
- **2 — weak:** partially implemented or risky in normal use;
- **1 — absent:** the capability is mostly missing.

## Scorecard

### Product goals: 4.0 / 5

Most checked acceptance criteria in `SPEC.md` are implemented. Snapshot caching and refresh, pages publishing, layouts and zones, bindings, navigation, gallery, templates, media, backup, and static deployment all have code and tests behind them.

The score is not higher because first-class item listing patterns, a document browser, embedded editor preview, and `lastModified` remain incomplete or explicitly planned. These are meaningful parts of the stated product ambition rather than optional internal cleanup.

### Architecture: 4.3 / 5

The main dependency direction is good:

1. `packages/model` defines and validates the flattened document.
2. `packages/renderer` consumes that contract.
3. `apps/site` hosts the public runtime.
4. `apps/editor-api` assembles records and publishes output.
5. `apps/editor` edits the authoring files through the API.

The renderer does not depend on the editor, a site remains data rather than source code, and the public website does not need Node at request time. Those are strong boundaries.

The deductions are for parallel write paths in the library, duplicated registry and shell-parsing concerns, and the growing size of the editor and `SiteStore` coordinators.

### Maintainability: 3.0 / 5

The code uses strict TypeScript and generally clear names, but concentration and duplication are now visible:

- `apps/editor/src/app.ts` is about 2,900 lines and combines routing, page rendering, event binding, record creation, session state, dialogs, and feature orchestration.
- `escapeHtml` is implemented separately in ten editor files.
- record-creation flows repeat the same validation, disabled-button, save, notice, and navigation sequence.
- route handlers repeatedly perform the same authentication and site checks.
- library record mutations duplicate part of `SiteStore` but omit its rollback behavior.

The project is not a “ball of mud.” The smells are mostly local and have clear extraction boundaries.

### Tests and type safety: 4.0 / 5

Strict TypeScript is enabled across the workspaces. The existing tests cover the model, renderer, sections, editor forms and canvases, authentication, records, backups, migrations, publishing, and atomic file operations.

The most important gaps are at orchestration boundaries:

- editor hash routing and route transitions;
- preservation and clearing of unsaved editor sessions;
- record rollback when flattening fails;
- library deletion or update when rebuilding fails;
- case-insensitive username behavior;
- a route-by-route authentication matrix;
- an end-to-end browser path from login through edit and publish.

No measured code-coverage percentage is claimed in this report.

### Author experience: 3.2 / 5

The author can start a blank site, create pages, use templates, compose sections, manage images and PDFs, change styles, preview, publish, and restore backups. That is a substantial achievement.

The largest weakness is feedback. Compose edits stored HTML but does not show the real rendered page beside the editor. Navigation causes broad `innerHTML` replacement, some dialogs and mode controls lack complete keyboard semantics, and the roadmap itself says a full author “snagging pass” has not been recorded. The authoring model is ahead of the surrounding interface.

### Operations and release: 3.2 / 5

Static publication, atomic installation, backups, restore safety, data outside the release directory, and migration hooks form a sensible self-hosting story.

The release workflow only runs for version tags and immediately packs a release. There is no pull-request workflow that runs typechecking and tests first. The default `admin` / `admin` seed account also relies on the operator reading the documentation and changing it.

### Security for the documented trusted-team model: 3.5 / 5

Positive controls include scrypt password hashing, timing-safe comparison, login rate limiting, HTTP-only same-site cookies, path validation, atomic writes, and preview traversal checks.

The rating is specifically for one trusted team on one self-hosted site. Tessera is not yet suitable for untrusted authors or multi-tenant use:

- authored HTML is trusted and intentionally not sanitized by the renderer;
- every authenticated editor has full access;
- the seed password is public;
- the login response exposes the session token in JSON as well as setting an HTTP-only cookie;
- uploads have no explicit size limit and are read fully into memory.

These limitations should be described as deployment boundaries, not hidden as implementation details.

### Documentation accuracy: 4.0 / 5

The project has a strong specification, architecture guide, roadmap, user guide, and README. They explain intent as well as mechanics.

There is some drift:

- `SPEC.md` and `ARCHITECTURE.md` still say version 0.1 while the root package is 0.2.7;
- parts of `SPEC.md` still describe the editor as a later phase even though a substantial editor is shipped;
- `ARCHITECTURE.md` can be read as saying the renderer is not hosted by the editor, although the API already serves the snapshot at `/preview/`; the missing feature is an embedded Compose preview;
- migration `002-asset-library.sh` is not described alongside migration 001;
- `scripts/pack-release.sh` still checks removed example-site names even though Willow is the only current example.

## How well Tessera meets its stated goals

### Goal: publish a complete small site as a snapshot or pages

**Rating: 4.7 / 5 — achieved.**

The snapshot flavour writes a content-hashed document and revision file, uses schema-aware local storage, and polls for revisions. The pages flavour writes one HTML file per page and a sitemap. Publication keeps the two flavours separate. The public result is static and can be served with the editor stopped.

Evidence is concentrated in `packages/renderer/src/document-cache.ts`, `packages/renderer/src/publish-pages.ts`, `apps/editor-api/src/site/dist.ts`, and their tests.

The remaining concern is not the delivery model but release safety: CI should prove both flavours before a release tag can be packed.

### Goal: structured content without recursive zones

**Rating: 4.5 / 5 — achieved.**

Layouts declare zones, pages and items contribute content, types choose layouts and fields, and the model validates the flattened result. This is the clearest and strongest part of Tessera's design. It avoids the recursive-template problem described in `SPEC.md` while retaining reusable items and bindings.

Authored YAML is only loosely checked before assembly, however. Invalid records can be submitted and are rejected during the rebuild rather than by a focused, kind-specific validation step.

### Goal: enough shared components to build a useful site

**Rating: 3.4 / 5 — partly achieved.**

Navigation presentations, bindings, gallery, common layout treatments, dated lists, people grids, and Compose sections exist. Willow proves that these pieces can form a community site.

The specification still lists first-class listing/blog patterns and a document browser as open. Current people, event, and news behavior is assembled from types and bindings rather than presented as a general author-facing pattern. That is functional, but it does not yet meet the full ambition in `SPEC.md`.

### Goal: mobile-friendly, portable static output

**Rating: 4.6 / 5 — achieved.**

The W3 skin and starter layout provide an adaptive default. The site Vite configuration deliberately uses `base: "./"`, and runtime/media URLs are relative so output can live below a domain root. Tests in `apps/site/src/relative-assets.test.ts` protect this behavior.

The editor is intentionally root-hosted and uses root-relative API paths. That is consistent with the documented same-origin cookie model and should not be “fixed” to match the public site.

### Goal: survive later fetch failures

**Rating: 4.5 / 5 — achieved for the required case.**

The required mid-session behavior is implemented: a successfully loaded compatible document can remain usable from memory or local storage, and the runtime can display stale status. Cold-start offline support is explicitly optional, so its absence is not a defect.

### Goal: clear editor boundary and a complete authoring loop

**Rating: 3.8 / 5 — substantially achieved.**

Although early wording calls the editor “later,” Tessera now has authentication, structured and raw editing, Compose, templates, a media library, styles, users, backups, preview, publish, and a starter site.

The authoring loop is real but not yet smooth. The preview is a separate rendered snapshot, the editor shell has accessibility gaps, and the end-to-end experience has not had the recorded snagging pass promised by the roadmap.

## What should be preserved

### Keep the static public-site boundary

The editor is a build and authoring service, not the public request path. This reduces public attack surface and makes hosting predictable. Adding a public database-backed rendering path would work against Tessera's central advantage.

### Keep one validated flattened contract

`SiteDocument` in `packages/model` is the right integration boundary between authoring and rendering. New authoring validation should lead into this contract, not create a second public content model.

### Keep sites as data

A site directory contains records, files, shell, preview, and output, but not site-specific executable component code. The shared catalogue makes upgrades and security review more tractable.

### Keep relative public URLs

Subdirectory portability is a stated requirement and is correctly protected in the site Vite configuration and tests. Any future preview or publisher work must retain relative public assets.

### Keep the current low-level safety patterns

Atomic temp-and-rename writes, per-path serialization, publish staging, restore safety archives, record ID checks, and preview path checks are all worth preserving and reusing.

### Keep deliberate limitations until requirements change

File-backed storage, one site per process, all-or-nothing editor access, hash routing for snapshot sites, and trusted authored HTML are conscious product choices. They should be clearly documented. They should not be replaced merely because larger CMS products make different choices.

## Prioritized findings

### Critical product-operating boundary: default credentials

The release seeds `admin` / `admin` when a site has no users, and the password is documented in `README.md`. This is convenient for local setup but dangerous when an editor is exposed before the operator changes it.

The immediate improvement is a mandatory first-login password change or a one-time bootstrap secret supplied through the environment. Until that exists, deployment documentation should require changing the password before making the editor reachable from the internet.

Relevant files:

- `apps/editor-api/seed/users/admin.json`
- `apps/editor-api/src/store/users.ts`
- `apps/editor-api/src/routes/auth.ts`
- `README.md`

### High: library mutations do not share record rollback

`SiteStore.commitText` writes a record, rebuilds the document, and restores the previous bytes if rebuilding fails. `AssetLibrary.writeRecord` writes YAML directly and then calls `site.rebuild()`. Folder and asset deletion unlink files before rebuilding.

This creates inconsistent failure behavior. A malformed or otherwise unbuildable site can leave a library record deleted or changed while the preview still represents the old state. It also duplicates the concept “change a record and refresh the snapshot.”

The library should use one transactional record-mutation service shared with normal records. Blob and thumbnail operations need explicit compensation around that transaction.

Relevant files:

- `apps/editor-api/src/site/store.ts`, especially `commitRecord` and `commitText`;
- `apps/editor-api/src/site/library-store.ts`, especially `deleteFolder`, `deleteAsset`, and `writeRecord`;
- `apps/editor-api/tests/library.test.ts`.

### High: validation happens too late

Record reads and writes primarily use `Record<string, unknown>`. YAML is checked to be a mapping and the complete document is validated when it is assembled, but there are no focused authored schemas for each record kind.

The rollback path prevents many invalid edits from remaining on disk, which is good. The weakness is error quality and boundary clarity: a bad page, layout, binding, media record, or navigation record is discovered as a whole-site rebuild failure instead of a local field error.

Add authored-record schemas or validators for each kind and run them before mutation. Keep final `SiteDocument` validation as a second line of defence.

Relevant files:

- `apps/editor-api/src/site/document.ts`;
- `apps/editor-api/src/site/store.ts`;
- `packages/model/src/schema.ts`;
- editor form schemas under `apps/editor/src/forms`.

### High: editor orchestration is concentrated in one file

`apps/editor/src/app.ts` contains the hash router, chrome, every main screen, record creation, editor mode switching, draft-session state, dialogs, library picker, and event wiring. The file is about 2,900 lines.

The issue is change risk, not the absence of a framework. A change to one screen requires navigating unrelated behavior, and the central flows are hard to test without mounting most of the application.

Extract pure routing first, then chrome, then one feature at a time. Do not perform a framework migration at the same time. The existing API and form modules already provide useful seams.

### High: central editor flows have thin tests

Forms, Compose, Arrange, and API helpers have meaningful unit tests. Hash parsing, route transitions, draft lifetime across modes, the embedded site/nav editors, and picker orchestration do not have equivalent direct coverage.

This makes a safe split of `app.ts` harder. Characterization tests must come before moving behavior.

Relevant areas:

- `parseRoute`, `render`, `bindEdit`, `contentSession`, and `layoutSession` in `apps/editor/src/app.ts`;
- `apps/editor/src/*.test.ts`;
- `apps/editor/src/compose/*.test.ts`;
- `apps/editor/src/arrange/*.test.ts`.

### High: username matching is inconsistent

`UserStore.findUser` deliberately matches names without regard to case, and user creation uses it to prevent collisions. Login and session loading use case-sensitive `getUser`.

The result is an inconsistent identity rule: `Alice` prevents creating `alice`, but `alice` cannot log in as `Alice` unless the exact stored case is used. Session restoration can also fail if a stored session and renamed user differ in case.

Choose one canonical lookup method for authentication and administration. Preserve the stored display spelling, but resolve identity with a normalized key.

Relevant files:

- `apps/editor-api/src/store/users.ts`;
- `apps/editor-api/src/routes/auth.ts`;
- `apps/editor-api/src/middleware/auth.ts`;
- `apps/editor-api/tests/auth.test.ts`;
- `apps/editor-api/tests/users.test.ts`.

### Medium-high: no pull-request CI gate

`.github/workflows/release.yml` runs only for `v*` tags and calls `npm run pack`. There is no workflow for pull requests or ordinary pushes that explicitly runs typechecking and tests.

This allows a release tag to become the first shared environment that exercises the repository. Add CI before making large refactors. Keep release packaging separate, but make it depend on the same checks.

### Medium-high: upload resource limits are missing

The upload route parses all multipart files and converts each file to an in-memory byte array. There is no explicit per-file or per-request limit. Authentication reduces exposure but does not prevent accidental exhaustion or abuse of a compromised editor account.

Add configurable limits and return HTTP 413 for oversized requests. Document the defaults and ensure rejected uploads leave no blobs or records behind.

Relevant files:

- `apps/editor-api/src/routes/library.ts`;
- `apps/editor-api/src/site/library-store.ts`;
- `apps/editor-api/tests/library.test.ts`.

### Medium: full editor rerenders affect state and accessibility

The hash router frequently replaces `root.innerHTML`, including the entire chrome. This discards focus, scroll position, and incidental DOM state. Route changes are not announced consistently to assistive technology.

An incremental improvement is enough: keep stable chrome mounted, replace the main region, focus its heading after navigation, and expose a route-status announcement. This can happen after router characterization tests.

### Medium: dialog and mode controls have incomplete semantics

The library picker has `role="dialog"` but lacks a complete modal pattern: labelled title, `aria-modal`, focus trap, Escape handling, and focus restoration. Arrange/Compose/Fields/Raw controls act like tabs or toggle buttons without fully expressing selected state.

Create one dialog helper and choose one honest mode-control pattern: either tabs with keyboard behavior or buttons with `aria-pressed`.

### Medium: repeated route guards and rebuilds

Most API handlers repeat `requireEditor`, response detection, site lookup, and 404 handling. Library create, update, and upload paths can also rebuild inside `AssetLibrary` and then rebuild again in the route.

Introduce middleware that resolves an authenticated site context, and assign one layer ownership of rebuilding. This reduces boilerplate and removes accidental duplicate work.

Relevant files:

- `apps/editor-api/src/routes/*.ts`;
- `apps/editor-api/src/access/editor.ts`;
- `apps/editor-api/src/site/library-store.ts`;
- `apps/editor-api/src/routes/library.ts`.

### Medium: session token is returned to browser JavaScript

Login sets an HTTP-only cookie and also includes the raw session token in the JSON response. The editor does not need to read the cookie, which is a security benefit, but the response makes the same credential visible to JavaScript and potentially to client-side logging.

Use cookie-only login for the browser. If Bearer tokens are required for automation, provide a separate, explicit token-creation path with its own scope and documentation.

### Medium: duplicated editor helpers and create flows

`escapeHtml` appears in ten editor source files. `fieldId`, notice/error panels, reorder icons, and create-record orchestration are also repeated.

These are good early extractions because they can be changed without altering the product design:

- put HTML escaping, field ID generation, and status markup in a small `dom.ts`;
- put shared SVGs and icon-button rendering in `editor-icons.ts`;
- represent create-record behavior as a small configuration object around one tested function.

Avoid importing the whole renderer package only to reuse its `escapeHtml`; the editor should own a tiny dependency-free helper.

### Medium: `SiteStore` has too many responsibilities

`SiteStore` is a coherent facade but now handles record listing and CRUD, order files, document assembly, history, snapshot output, publication, and bulk import. The misleading `siteDir` name actually points to the records directory, which increases the chance of joining the wrong path.

Rename `siteDir` to `recordsDir` first. Later extract a record repository and snapshot/publish coordinator while keeping `SiteStore` as the facade used by routes. Do not split it before transactional mutation tests exist.

### Low-medium: duplicated publishing and media utilities

Default component registration is repeated between the site runtime and editor API publishing. Stylesheet-link parsing and media extension normalization also have parallel implementations.

Extract these only after higher-risk write behavior is fixed:

- a shared default publish registry in `packages/renderer`;
- one shell stylesheet parser;
- one media-record parser and extension normalizer.

### Low-medium: tooling and package hygiene

There is no shared linter or formatter configuration. `apps/editor` imports `happy-dom` in tests but does not declare it directly, relying on workspace hoisting. Some packages have no direct smoke tests. Workspace package versions remain at 0.1.0 while the root is 0.2.7.

These issues are real but should not displace data-integrity and editor-boundary work. Introduce formatting with a baseline-only commit to avoid mixing mechanical changes with behavior.

### Low: documentation and naming drift

The documentation needs a consistency pass, and a few names obscure current intent:

- update old phase/version language;
- document migration 002;
- explain that `/preview/` exists but is not embedded in Compose;
- remove stale example names from the release pack loop;
- rename `packages/extras/src/pure.ts` if it no longer represents a current example;
- rename editor helpers such as `showNewPageError` when they serve templates, layouts, and types too.

## Comparison with other content management systems

This section compares architectural and product fit. It does not claim that the projects have similar user bases, funding, age, or ecosystem size. Tessera is a focused 0.2.x product; the named alternatives are useful reference points, not equal competitors.

### Compared with Kirby

[Kirby](https://getkirby.com/docs/guide/tour) is the closest broad architectural comparison. It stores content in files and folders, does not require a database, and provides a web-based editing Panel. It also supports configurable blueprints, drafts and publishing states, a REST API, plugins, and [fine-grained roles and permissions](https://getkirby.com/docs/guide/users/permissions).

Where Tessera is stronger or more distinctive:

- Tessera's output is explicitly a static `publish/` tree. Node can be stopped and the site continues to work.
- Snapshot and pages delivery are first-class alternatives in the same content model.
- Folder-relative output is a tested product requirement rather than a deployment option.
- Bindings provide a clear data-to-shared-component mechanism without allowing site records to inject executable code.

Where Kirby is stronger:

- its Panel and content workflow are substantially more mature;
- blueprints, page states, roles, permissions, multilingual support, APIs, and plugins cover a wider range of sites;
- templates and site behavior are directly extensible per project.

The practical choice is scope. Tessera is attractive when the desired result is a constrained, portable static site with a shared component catalogue. Kirby is a better fit when a project needs a mature file-based CMS platform with site-specific templates, plugins, workflow, or permissions.

### Compared with Grav

[Grav](https://www.getgrav.org/features) is also a database-free, file-based CMS. Current Grav provides a modern admin application, a first-party API, themes, plugins, package management, blueprints, user permissions, and a much larger extension surface.

Where Tessera is stronger or simpler:

- the public output has no PHP or CMS request path;
- there is one deliberately small content/rendering contract;
- a site cannot silently accumulate arbitrary plugin code;
- the two static delivery modes and relative-folder portability are easy to explain and test.

Where Grav is stronger:

- mature theme and plugin ecosystems;
- first-party API and headless use;
- richer admin extension points, multilingual features, workflows, and package management;
- much broader choice for developers building site-specific behavior.

Tessera trades extensibility for uniformity. That is valuable for a fleet of similarly governed small sites, but limiting for agencies or developers who expect each site to install its own theme and plugins.

### Compared with Publii

[Publii](https://getpublii.com/) is a desktop application that builds static websites locally and publishes them to services such as GitHub Pages, Netlify, S3, FTP, and SFTP. It emphasizes approachable editing, themes, SEO features, and a public site with no database or exposed admin.

Shared strengths:

- both produce a static public site;
- both separate editing from public delivery;
- both can suit small content-focused sites without a server-side public CMS.

Tessera's advantages:

- browser-based multi-user editing on a self-hosted instance;
- structured site records, layouts, bindings, and a reusable component catalogue;
- a snapshot mode with cache and offline-stale behavior as well as pages output;
- site data that can be managed as a directory on a server.

Publii's advantages:

- a more polished, beginner-oriented desktop authoring workflow;
- built-in publishing destinations, themes, SEO, social metadata, responsive-image, and plugin features;
- no internet-accessible editor service to operate.

Choose Tessera when several trusted users need a browser editor and a constrained shared rendering system. Choose Publii when one author or a small desktop-based workflow values simple static publishing and established content-site features.

### Compared with Decap CMS

[Decap CMS](https://decapcms.org/features/) is a web editor for Git-backed static sites. It provides structured fields, rich text, live preview, repository history, and optional editorial workflow while leaving site generation to frameworks such as Hugo, Gatsby, Next.js, or Jekyll.

Tessera owns more of the stack: content model, editor, renderer, pages publisher, snapshot runtime, and deployment shape. That gives authors and operators one coherent product and avoids requiring a separate static-site generator and Git workflow.

Decap is stronger when Git is the desired source of truth, content review should use branches or pull requests, or the website already has a framework and build pipeline. Tessera is stronger when Git concepts should stay out of the authoring experience and immediate local file publication is preferred.

### Compared with Strapi and Sanity

[Strapi](https://strapi.io/) and [Sanity](https://www.sanity.io/) represent an API-first content-platform category rather than Tessera's direct niche. Strapi generates REST and GraphQL APIs from content models and supports self-hosted or managed operation. Sanity provides a managed real-time content store, query APIs, and a customizable collaborative editing studio.

Tessera is intentionally weaker at:

- delivering content to many applications through an API;
- real-time collaboration;
- granular roles, review workflows, audit features, and enterprise identity;
- large datasets and independent content queries;
- plugin and integration ecosystems.

Tessera is intentionally stronger or simpler at:

- producing a complete copyable website without a separate frontend application;
- keeping the public site independent of an online CMS or content API;
- making all editable site data inspectable as files;
- predictable single-site backup, restore, and deployment;
- low public hosting cost and attack surface.

It would be a mistake to chase feature parity with API-first systems. If Tessera needs to serve multiple applications, support many editorial teams, or query large shared datasets, that is a product-category change and should be decided explicitly before modifying the architecture.

### Competitive position

Tessera's credible niche is:

> A self-hosted editor and static publisher for small, structured sites that need a shared component catalogue, portable output, and little public infrastructure.

Its strongest differentiators are the dual snapshot/pages model, data-driven bindings, no site-specific executable code, and a clean static handoff. Its biggest competitive weaknesses are editor polish, first-class content-listing patterns, workflow and permissions, ecosystem size, and out-of-the-box SEO/deployment integrations.

The project should deepen its niche before broadening it. Embedded preview, reliable transactional editing, polished common author tasks, and complete listing/document patterns will improve the product more than adding a generic public API or plugin marketplace.

## Improvement playbook

This playbook is intentionally explicit. Each numbered unit should normally be a separate pull request. A less-capable implementation agent should finish the tests and acceptance checks for one unit before starting the next.

General rules for every unit:

1. Read the named files and their existing tests before editing.
2. Add a failing characterization or regression test before changing behavior.
3. Keep public-site URLs folder-relative. Do not change `apps/site/vite.config.ts` from `base: "./"`.
4. Do not combine refactoring, formatting, and product behavior in one pull request.
5. Run the narrow workspace tests while working, then run root typechecking and tests before handoff.
6. If an existing test must change, explain which intended behavior changed. Do not update snapshots merely to make tests green.
7. Stop if the requested change needs a product decision listed under “Decisions required” below.

### Phase 1: establish the safety baseline

#### PR 1.1 — Add pull-request CI

Why first: all later work changes central authoring paths. Shared automated checks must exist before those changes begin.

Files:

- add `.github/workflows/ci.yml`;
- update `.github/workflows/release.yml` only if release should call a reusable workflow;
- use scripts already defined in `package.json`.

Steps:

1. Trigger CI on pull requests and pushes to the default branch.
2. Use Node 20, `actions/checkout`, `actions/setup-node` with npm cache, and `npm ci`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build` as a separate step so packaging assumptions are checked.
6. Give each step a clear name; do not hide all commands in one shell block.
7. Leave tag packaging in the release workflow. If workflows are made reusable, ensure a release cannot run after failed checks.

Acceptance:

- CI runs on a test pull request;
- typechecking, tests, and build are individually visible;
- a deliberately broken type fails CI;
- tag releases still create the same artifacts.

Stop condition: if the repository no longer uses GitHub as its release host, confirm the target CI service before adding GitHub Actions.

#### PR 1.2 — Characterize high-risk back-end behavior

Why: rollback, identity, and rebuild behavior must be pinned down before refactoring.

Files:

- `apps/editor-api/tests/auth.test.ts`;
- `apps/editor-api/tests/records.test.ts` or a new `record-rollback.test.ts`;
- `apps/editor-api/tests/library.test.ts`;
- `apps/editor-api/src/site/store.ts`;
- `apps/editor-api/src/site/library-store.ts`.

Steps:

1. Add a login test with a stored mixed-case username and differently cased input. Write the expected rule in the test name.
2. Add a test that saves an invalid record which makes assembly fail. Assert that the previous YAML bytes and previous snapshot revision remain unchanged.
3. Add a test for creation of a new invalid record. Assert that no file remains after failure.
4. Add tests for library record update and deletion when `site.rebuild()` fails.
5. Add a spy or injected counter proving each successful library action rebuilds at most once.
6. Do not fix behavior in this PR unless a test reveals the existing code already promises it. Mark tests for known defects clearly if the project policy permits, or land the fixes in PR 2.1 immediately after.

Commands:

```sh
npm test -w @r-a-i-t-h/tessera-editor-api
npm run typecheck -w @r-a-i-t-h/tessera-editor-api
```

Acceptance:

- normal record rollback is directly tested;
- current library failure behavior is documented by a test;
- rebuild counts are measurable without timing assertions;
- tests use temporary directories and do not write to repository data.

#### PR 1.3 — Characterize editor routing and draft lifetime

Why: `app.ts` cannot be split safely while route and draft behavior is implicit.

Files:

- `apps/editor/src/app.ts`;
- add `apps/editor/src/router.test.ts` after extracting only the minimum pure function;
- add an editor orchestration test using `happy-dom`;
- add `happy-dom` to `apps/editor/package.json` dev dependencies.

Steps:

1. Move only the `Route` type and `parseRoute` logic to `apps/editor/src/router.ts`. Make the parser accept a hash string rather than reading `window` directly.
2. Keep a tiny call in `app.ts`: `parseRoute(window.location.hash)`.
3. Test empty, home, records, library, account, user, edit, legacy `site`/`nav`, encoded IDs, and malformed extra-segment routes.
4. Add tests for Compose → Fields → Compose and Arrange → Raw → Arrange with an unsaved draft.
5. Add a test defining what happens when an author leaves an edit route and returns.
6. Test the special site/nav editor embedded in the records screen.

Acceptance:

- route parsing has no DOM dependency;
- all current route aliases are covered;
- intended draft persistence is stated by tests;
- the editor workspace can install and test in isolation.

### Phase 2: protect data and credentials

#### PR 2.1 — Use one canonical username lookup

Why: authentication identity must have one rule.

Files:

- `apps/editor-api/src/store/users.ts`;
- `apps/editor-api/src/routes/auth.ts`;
- `apps/editor-api/src/middleware/auth.ts`;
- `apps/editor-api/tests/auth.test.ts`;
- user-management tests.

Steps:

1. Add a private normalized index keyed by lowercase normalized username, or make one public lookup method authoritative.
2. Preserve the stored username's spelling for display and filenames.
3. Use canonical lookup for login and session loading.
4. Keep collision checks case-insensitive.
5. Verify rename updates both exact and normalized indexes atomically.
6. Verify disabling a user invalidates effective session access regardless of case.

Acceptance:

- `Alice`, `alice`, and `ALICE` resolve to the same identity;
- two users differing only by case cannot be created;
- responses still show the stored spelling;
- existing user files are not renamed merely by loading them.

#### PR 2.2 — Route every record mutation through rollback

Why: library metadata must have the same consistency guarantee as pages and layouts.

Files:

- `apps/editor-api/src/site/store.ts`;
- `apps/editor-api/src/site/library-store.ts`;
- `apps/editor-api/src/routes/library.ts`;
- `apps/editor-api/tests/library.test.ts`;
- rollback tests from PR 1.2.

Steps:

1. Expose narrow `SiteStore` methods for writing and deleting media/folder records. Do not expose raw path joining.
2. Implement deletion as a transaction: capture previous bytes, remove the record, rebuild, and restore on failure.
3. For asset deletion, decide operation order explicitly:
   - mutate the record transactionally;
   - move blob and thumbnail to temporary names or retain restorable bytes;
   - complete deletion only after rebuild succeeds;
   - restore all parts on failure.
4. For upload, clean up blob and thumbnail when record commit or rebuild fails.
5. Make either `AssetLibrary` or the route own rebuild, never both. Prefer the transactional record method owning it.
6. Return the resulting snapshot reference from the mutation so routes do not rebuild to obtain it.

Acceptance:

- failed media/folder create, update, and delete leave records, blobs, thumbnails, and preview mutually consistent;
- successful operations rebuild exactly once;
- no route accesses `site.siteDir` to construct record paths;
- all library and record tests pass.

Stop condition: if atomic rollback of large blobs would require holding them in memory, use same-filesystem temporary renames, not byte buffering.

#### PR 2.3 — Validate authored records before writing

Why: errors should identify the record and field before a whole-site rebuild.

Files:

- add `apps/editor-api/src/site/authored-schema.ts`, or place shared authored schemas in `packages/model` if the editor also needs them;
- `apps/editor-api/src/site/document.ts`;
- `apps/editor-api/src/site/store.ts`;
- `apps/editor-api/src/http.ts`;
- record tests for every kind.

Steps:

1. List every authored kind: site, nav, content, templates, items, layouts, bindings, types, media, and folders.
2. Define the minimum valid authored shape for each kind. Keep editor-only fields such as `locked` and `templateId`.
3. Do not reuse the flattened page schema blindly; authored and flattened shapes differ.
4. Validate structured writes and raw YAML writes before touching disk.
5. Return a stable 400 response that names the record kind, record ID, field path, and understandable problem.
6. Keep complete `SiteDocument` validation during assembly. It catches cross-record errors such as unknown layouts and cycles.
7. Add tests for wrong scalar types, missing IDs, mismatched IDs, malformed layout trees, and valid unknown extension fields where they are supported.

Acceptance:

- a locally invalid record never reaches disk;
- cross-record errors still trigger rollback;
- Willow and the starter site flatten unchanged;
- raw editing remains possible and receives useful errors.

#### PR 2.4 — Bound uploads

Why: authenticated uploads can still exhaust process memory or disk.

Files:

- `apps/editor-api/src/routes/library.ts`;
- `apps/editor-api/src/site/library-store.ts`;
- configuration parsing near server startup;
- `README.md`;
- `apps/editor-api/tests/library.test.ts`.

Steps:

1. Define documented defaults for maximum file size, number of files, and total request bytes.
2. Allow environment overrides with validated positive integers.
3. Reject an oversized request with 413 before thumbnail generation or record writes.
4. If the framework cannot enforce a streaming limit before `parseBody`, document that limitation and add an upstream reverse-proxy limit as defence in depth.
5. Ensure partial batches have an explicit rule: either reject the whole request or return created/skipped entries. Test the chosen rule.
6. Clean up all temporary and created files after rejection or processing failure.

Acceptance:

- boundary-size uploads succeed;
- one byte over each limit fails predictably;
- failure leaves no orphaned blob, thumbnail, folder, or media record;
- deployment documentation gives a matching nginx `client_max_body_size` example.

#### PR 2.5 — Remove unsafe bootstrap and token defaults

Why: public seed credentials and JavaScript-readable browser sessions are avoidable risks.

Decision required before coding:

- choose first-login forced password change, environment-provided bootstrap credentials, or one-time generated credentials;
- decide whether external automation needs Bearer tokens.

Files after the decision:

- `apps/editor-api/src/store/users.ts`;
- `apps/editor-api/src/routes/auth.ts`;
- `apps/editor-api/src/model.ts`;
- seed files and startup code;
- `apps/editor/src` login/account UI;
- authentication tests;
- `README.md` and deployment docs.

Recommended implementation:

1. Generate or accept a one-time bootstrap credential when no users exist.
2. Store a `mustChangePassword` flag and prevent other editor mutations until changed.
3. Do not log a permanent password. If a generated one-time secret is logged, make that behavior explicit and only on first boot.
4. Remove `token` from normal browser login JSON.
5. If automation tokens are required, create separately revocable tokens rather than reusing browser sessions.

Acceptance:

- a fresh internet-facing install does not share a known credential;
- normal editor JavaScript never receives the session secret;
- first-login and password-change behavior is covered end to end;
- upgrades do not reset existing users or force an unintended password change.

### Phase 3: remove low-risk duplication

#### PR 3.1 — Centralize editor DOM helpers

Files:

- add `apps/editor/src/dom.ts`;
- update `apps/editor/src/app.ts`;
- update `apps/editor/src/forms/*.ts`;
- update `apps/editor/src/compose/view.ts`;
- update `apps/editor/src/arrange/view.ts`;
- update `apps/editor/src/styles-page.ts`;
- add `apps/editor/src/dom.test.ts`.

Steps:

1. Move one canonical `escapeHtml` implementation to `dom.ts`.
2. Move `fieldId` and status/notice markup to the same module.
3. Preserve exact generated markup on the first pass.
4. Replace call sites one file at a time and run editor tests after each group.
5. Add direct tests for `&`, `<`, `>`, double quotes, and single quotes if single quotes are part of the contract.
6. Do not import renderer utilities into the editor for this small helper.

Acceptance:

- only one editor implementation of each helper remains;
- output strings are unchanged except for an intentional, tested escaping fix;
- all editor tests pass.

#### PR 3.2 — Centralize icons and creation orchestration

Files:

- add `apps/editor/src/editor-icons.ts`;
- add `apps/editor/src/create-record.ts`;
- update `apps/editor/src/forms/nav.ts`;
- update `apps/editor/src/forms/type.ts`;
- update create functions in `apps/editor/src/app.ts`;
- add focused tests.

Steps:

1. Extract byte-identical up/down icons and a small accessible icon-button helper.
2. Define a `CreateRecordOptions` shape containing kind, form, ID field, existing IDs, body factory, destination mode, and messages.
3. Keep page-specific template and sidebar behavior outside the generic helper as hooks.
4. Replace template, layout, and type creation first.
5. Replace page creation only after the simpler paths are green.
6. Rename `showNewPageError` to a generic name.

Acceptance:

- no feature loses its tailored validation message;
- buttons re-enable after errors;
- navigating to the same hash still forces render;
- page sidebar-link failure still creates the page and reports a partial-success notice.

#### PR 3.3 — Share back-end normalization utilities

Files:

- media parsing code in `apps/editor-api/src/site/library.ts`;
- `apps/editor-api/src/site/library-store.ts`;
- shell stylesheet parsing in `apps/editor-api/src/site/dist.ts` and stylesheet routes;
- registry construction in `apps/site/src/main.ts`, `apps/site/src/pages.ts`, and `apps/editor-api/src/site/dist.ts`;
- `packages/renderer` if the shared function belongs there.

Steps:

1. Extract media extension normalization and media-record parsing locally within editor-api.
2. Add one shell-link parser with fixture tests.
3. Add a shared `createDefaultRegistry` only if all three current registries are meant to expose identical components.
4. Preserve an extension hook so a caller can register extra components after defaults.
5. Do not move editor-only code into `packages/renderer`.

Acceptance:

- generated pages and snapshot output are byte-equivalent where hashes are expected to remain stable;
- one golden shell fixture protects stylesheet extraction;
- registry tests prove expected built-ins and extras are present.

### Phase 4: split the editor without changing frameworks

#### PR 4.1 — Extract stable chrome and route rendering

Dependencies: PR 1.3 and PR 3.1.

Files:

- `apps/editor/src/app.ts`;
- existing `apps/editor/src/router.ts`;
- add `apps/editor/src/chrome.ts`;
- add `apps/editor/src/views/` modules.

Steps:

1. Move pure chrome HTML generation and navigation-state helpers to `chrome.ts`.
2. Keep one application mount and one hashchange listener.
3. Change rendering so stable header/footer chrome remains mounted and only `<main>` changes.
4. Move home, guide, account, and not-found views first.
5. Move one complex screen per later commit: users, backups, styles, library, records, edit.
6. Keep data fetching in `api.ts` and do not let view modules call `fetch` directly.
7. After navigation, set the document title, focus the main heading, and announce the route through a polite live region.

Acceptance:

- all old hashes render the same feature;
- focus behavior is tested;
- header controls do not receive duplicate listeners;
- browser back and forward work;
- `app.ts` becomes an orchestrator rather than a collection of all views.

#### PR 4.2 — Make editor session lifetime explicit

Files:

- add `apps/editor/src/editor-session.ts`;
- update edit binding code;
- update route transition code;
- add session tests.

Steps:

1. Move `contentSession`, `layoutSession`, `pendingEdit`, and undo-controller ownership into one small state object.
2. Define transitions: enter record, change mode, save, revert, leave record, log out.
3. Preserve unsaved content only across modes for the same record.
4. When navigating away with unsaved changes, either warn or discard according to a documented product decision.
5. Clear sessions on logout and when opening a different record.
6. Use `AbortController` for all listeners whose lifetime ends on route or record change.

Acceptance:

- no draft leaks into another record;
- same-record mode switching keeps the draft;
- save and revert reset the correct baseline;
- repeated mounts do not double-fire handlers.

#### PR 4.3 — Add a reusable accessible dialog

Files:

- add `apps/editor/src/dialog.ts`;
- update the library picker and any confirmation overlays;
- update CSS;
- add `happy-dom` tests.

Steps:

1. Render a labelled element with `role="dialog"` and `aria-modal="true"`.
2. Move focus into the dialog on open.
3. Trap Tab and Shift+Tab within the dialog.
4. Close on Escape and the explicit cancel action.
5. Restore focus to the opening control.
6. Make backdrop-click behavior a deliberate option rather than an accidental event.

Acceptance:

- all dialog actions work without a mouse;
- focus never escapes while modal;
- focus returns after close;
- opening and closing repeatedly does not leak listeners.

#### PR 4.4 — Correct edit-mode semantics

Files:

- edit-mode rendering and handlers currently in `apps/editor/src/app.ts`;
- related CSS and tests.

Steps:

1. Decide whether modes are tabs or toggle buttons.
2. If tabs, implement `tablist`, `tab`, `tabpanel`, `aria-selected`, roving tabindex, and arrow-key navigation.
3. If buttons, use a labelled toolbar and `aria-pressed`.
4. Preserve draft behavior and URL behavior.

Acceptance:

- the active mode is exposed to assistive technology;
- keyboard movement follows the chosen pattern;
- mode switches still preserve unsaved edits.

### Phase 5: clarify back-end boundaries

#### PR 5.1 — Add authenticated-site route middleware

Dependencies: route authorization tests from Phase 1.

Files:

- add middleware under `apps/editor-api/src/middleware/`;
- route files under `apps/editor-api/src/routes/`;
- `apps/editor-api/tests/editor-gate.test.ts`.

Steps:

1. Create middleware that calls `requireEditor`, stops on 401, resolves `site`, and stops on 404.
2. Add typed Hono context variables for the authenticated user and site.
3. Apply the middleware to protected route groups rather than repeating guards per handler.
4. Keep logout idempotent and health/login public.
5. Add a table-driven test covering every documented protected mutation.

Acceptance:

- adding a new protected route has one obvious secure pattern;
- no route loses its existing status code;
- anonymous access to every protected mutation returns 401;
- a configured app without a site returns the intended 404.

#### PR 5.2 — Rename paths before extracting classes

Files:

- `apps/editor-api/src/site/store.ts`;
- constructor call sites;
- tests and route code using `siteDir`.

Steps:

1. Rename `SiteStore.siteDir` to `recordsDir`.
2. Keep `siteRoot` for the instance root.
3. Replace joins that currently infer the root with explicit constructor dependencies.
4. Make no behavioral changes in this PR.

Acceptance:

- names accurately identify `$TESSERA_DATA` versus `$TESSERA_DATA/records`;
- no code uses `join(recordsDir, "..")` to recover the root;
- all tests pass unchanged.

#### PR 5.3 — Extract record repository and output coordinator

Dependencies: transactional mutation coverage and the path rename.

Files:

- split responsibilities currently in `apps/editor-api/src/site/store.ts`;
- add `record-repository.ts`;
- add `snapshot-service.ts` or `output-service.ts`;
- keep `SiteStore` as a facade initially.

Steps:

1. Move path calculation, list, read, order, and atomic record mutation into `RecordRepository`.
2. Move assemble/rebuild/snapshot/publish coordination into an output service.
3. Inject both into `SiteStore`; keep current public methods so route changes are minimal.
4. Keep page history coordination in `SiteStore` until a separate extraction has a clear benefit.
5. Remove `tryDocument`'s blanket error swallowing. Distinguish a site that is not ready from a corrupt site and log or return the latter.
6. Delete the unused `kind` parameter from `recordToYaml`, unless kind-specific serialization has been added.

Acceptance:

- `SiteStore` reads as a coordinator;
- one repository owns every authored-record path;
- one service owns snapshot and publish output;
- failure and rollback tests remain green;
- no new circular package dependencies appear.

### Phase 6: finish the stated product goals

These are product changes and should start only after the integrity and editor-boundary work above.

#### PR 6.1 — Embed the real preview

Files likely involved:

- editor edit view modules created in Phase 4;
- `apps/editor/src/app.css`;
- `apps/editor-api/src/preview.ts`;
- preview and editor tests;
- `ROADMAP.md`, `SPEC.md`, and `ARCHITECTURE.md`.

Steps:

1. Embed authenticated `/preview/` in an iframe beside or below Compose, Fields, and Raw.
2. After a successful save or explicit render, reload the iframe using a revision message or controlled URL update.
3. Do not render a second approximation inside the editor. Use the real snapshot runtime.
4. Add responsive behavior: stacked editor/preview on narrow screens and a usable split on wide screens.
5. Give the iframe an accessible title.
6. Decide whether unsaved changes can preview before save. If yes, design an explicit temporary-preview API; do not write hidden drafts into published records.

Acceptance:

- saved section changes appear without opening another tab;
- preview uses the same runtime and relative asset rules as standalone preview;
- authentication is required;
- preview never writes `publish/`;
- roadmap and architecture wording is updated in the same PR.

#### PR 6.2 — Define first-class listing patterns

Decision required: specify the smallest general pattern for “list on a page” and “entries as pages.” Do not add a second page model.

Files likely involved:

- `packages/model/src/schema.ts`;
- `packages/extras/src/`;
- `packages/renderer/src/`;
- editor binding/type forms;
- Willow records;
- renderer/editor tests;
- `SPEC.md` acceptance criteria.

Recommended direction:

1. Keep entries that need URLs as normal pages with a site-defined type.
2. Define a reusable listing binding that selects page types, optional tags, date window, order, and limit.
3. Ship a small set of presentations such as summary list, cards, and dated list.
4. Let the pages publisher render useful static listing markup when possible; hydrate only truly interactive behavior.
5. Demonstrate people, news, and events in Willow without custom one-off wiring.

Acceptance:

- an author can configure a listing without writing markup;
- each listed entry with a URL is still a normal page;
- snapshot and pages flavours show equivalent content;
- the open item-listing acceptance criterion in `SPEC.md` can be checked honestly.

#### PR 6.3 — Add a document browser

Files likely involved:

- a new component in `packages/extras`;
- library/media model and editor fields if extra metadata is required;
- Compose binding insertion;
- Willow example;
- renderer and pages-publisher tests.

Steps:

1. Write an author-facing use case before the schema: for example, browse PDFs by folder, title, date, and category.
2. Reuse media and virtual folders rather than creating a second document store.
3. Add only metadata needed by the agreed use case.
4. Render a usable static list for pages output and enhance it for filtering if JavaScript is available.
5. Ensure document links remain folder-relative from nested pages.

Acceptance:

- authors manage documents through the existing library;
- visitors can browse and download without JavaScript for the basic path;
- snapshot and nested pages use correct relative URLs;
- the document-browser row in `SPEC.md` can be marked complete.

#### PR 6.4 — Add `lastModified`

Decision required: define which entities carry the value and whether it is authored, file-derived, or updated by the editor.

Recommended direction:

1. Store an editor-managed ISO timestamp on pages and reusable items.
2. Update it only when material content changes, not when a preview is rebuilt.
3. Preserve it through flattening.
4. Allow layouts/components to display it but do not force it into every design.
5. Define migration behavior for existing records.

Acceptance:

- timestamps are stable across no-op saves and rebuilds;
- real content edits update them;
- old sites migrate predictably;
- pages and snapshot output expose the same value.

### Phase 7: maturity work

#### PR 7.1 — Add one browser smoke journey

Use Playwright or the repository's chosen browser runner.

Journey:

1. start the API with a temporary `TESSERA_DATA`;
2. bootstrap and sign in;
3. create or edit a page;
4. switch editor modes;
5. save and view the embedded preview;
6. publish;
7. assert expected `publish/` files and open one nested page.

Keep the first suite small. Its purpose is to prove integration, not reproduce every unit test in a browser.

#### PR 7.2 — Introduce linting and formatting

Steps:

1. Choose one toolchain: Biome, or ESLint plus Prettier.
2. Add root scripts and CI steps.
3. Exclude generated publish output and release artifacts.
4. Apply the initial mechanical formatting in a standalone pull request.
5. Enable a conservative rule set first. Add stricter rules only when they detect a demonstrated class of defect.

Acceptance:

- clean checkout passes lint;
- formatting is deterministic;
- behavior changes are not mixed into the baseline commit.

#### PR 7.3 — Package and release hygiene

Steps:

1. Add direct smoke tests for `wc-base`, `extras`, and `skin-w3` where behavior warrants them.
2. Decide whether workspace package versions should follow the root version; automate the selected policy.
3. Remove stale example names from `scripts/pack-release.sh`.
4. Add a `LICENSE` if the project is intended for distribution under an open-source license.
5. Document whether committed Willow publish output is a reference fixture or generated artifact.
6. Test the packed tarball by starting it against a temporary site before attaching it to a release.

## Documentation corrections to make early

These changes are low risk and can accompany Phase 1 if kept separate from behavior:

1. Update `SPEC.md` and `ARCHITECTURE.md` version/status wording without confusing product version, authoring schema version, and `SiteDocument.version`.
2. Change “editor later” language to historical context or current boundaries.
3. State precisely that the API serves `/preview/`, while the missing roadmap feature is embedding that preview in the editing screen.
4. Document migration 002 and the rule for future record-transforming migrations.
5. Keep `GUIDE.md` and `apps/editor/src/guide.ts` synchronized, preferably with a test or one generated source.
6. Add a production checklist: HTTPS, secure cookies, bootstrap credential change, data/backup permissions, upload limit, and nginx cache rules.

## Decisions required before implementation

An implementation agent should stop and ask the product owner rather than guessing about these:

- Should usernames be case-insensitive for login? This assessment recommends yes because collision checks already are.
- What bootstrap credential flow should replace `admin` / `admin`?
- Are Bearer tokens needed for external automation, and if so, what scopes and revocation are required?
- Should navigating away from an unsaved record warn, retain, or discard?
- Should embedded preview show only saved content or support temporary unsaved drafts?
- What exact author task defines the first-class listing pattern?
- What metadata and browsing behavior define a “document browser”?
- Which entities receive `lastModified`, and what event updates it?
- Is trusted authored HTML a permanent deployment boundary or must untrusted authors be supported?

## Changes not recommended now

- Do not migrate the editor to React, Vue, or another framework solely to split `app.ts`. Module boundaries and tests are the immediate need.
- Do not replace YAML files with a database unless scale or concurrency requirements demonstrate the need.
- Do not add recursive zones; that would reverse the core Tessera design.
- Do not let sites install arbitrary executable components without a deliberate plugin security and versioning design.
- Do not add a public content API merely to match headless CMS products.
- Do not change the public Vite base to `/`; subdirectory-relative output is a product requirement.
- Do not sanitize trusted HTML silently. If the trust model changes, design sanitization, migration, allowed markup, and author feedback together.
- Do not introduce granular ACL piecemeal inside route handlers. Replace the centralized `requireEditor` policy only after roles and permissions are specified.

## Suggested end state

After the plan is complete, Tessera should still look like Tessera:

- a site is a portable directory of data and files;
- the public output is static and subdirectory-relative;
- layouts own zones and content fills them;
- one validated document joins authoring to rendering;
- the editor uses the real renderer for preview;
- every authored mutation is validated and transactional;
- editor screens are small, testable modules;
- common content patterns are available without author-written markup;
- CI, browser smoke coverage, and deployment defaults make releases predictable.

The plan deliberately improves trustworthiness and author experience before expanding the architecture. That ordering gives the highest return while preserving the project's clearest strengths.

## Verification baseline

The following checks passed on 6 October 2026:

```sh
npm run typecheck
npm test
```

Typechecking passed in all ten workspaces named by the root script. The test run passed **294 tests in 60 test files**:

- model: 23 tests;
- sections: 12 tests;
- renderer: 73 tests;
- site: 6 tests;
- editor: 79 tests;
- editor API: 101 tests.

The test command also completed the production builds that are part of the site and editor workspace test scripts. These results establish a healthy current baseline, not a measurement of code coverage or a substitute for the missing browser journey and pull-request CI.

