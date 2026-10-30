# Editor and page-model review

Review date: 21 October 2026.

The editor is big and a tad clunky. The foundations are sound, and it works. We know about the splinters, the growth, and the disjointed responsibilities below. A large-scale change — a UI framework, a widget system on types, or a rewrite of the editor — would not bring an appreciable benefit at this time, so we are not doing one.

This note follows the broader scorecard in [ASSESSMENT.md](./ASSESSMENT.md) (6 October 2026). The product contract stays in [SPEC.md](./SPEC.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

## What we are keeping

A page stays a poster. It points at an optional type, holds string fields, includes, and zone content. A type is site data: an id, an optional layout, and a list of field ids (each optionally required). Layouts alone declare zones. A page with no type uses the site default layout.

A type still has three jobs, all about pages:

- **Shared layout.** Pages do not store a layout id. `resolvePageProfile` takes the layout from the type. On Willow, `event` and `news` share the article layout, `person` uses profile, and `meeting` uses meeting.
- **Short text on the poster.** The type names the strings the Page tab asks for. They stay strings, in text boxes. When a layout zone has the same id and no authored HTML, the renderer prints that string into the zone. A filled zone wins.
- **A family of real pages.** Nav `source.pageType`, `linkCluster`, and `peopleGrid` select pages of that type. Each match is still its own URL.

Items are reusable zone bags. Bindings pair a public id with a registered component. Neither is a page, and neither stretches `Page`.

**Datasets and runtime modules (since this review).** Tabular or nested data that is not prose on a page belongs in **`datasets/`** and reaches visitors through **dataset list** bindings (embedded into the flattened document at publish) or a **runtime module** binding. That is the schema-led path for booleans, numbers, dates, and refs — not extra fields on every page poster. **Runtime modules** are site-owner ESM under `runtime-modules/`; Tessera copies referenced files into `publish/` and runs them in the browser only. Catalogue micro-apps still ship with Tessera.

Page **posters** stay string fields plus zones for prose. Willow still lists events and news via **typed pages** and `datedList` on string `date` fields; that listing path is separate from datasets and remains fragile (see splinters below).

`blog`, `article`, and `blog-index` are reserved words in the type slot. They are not site type records. Articles have their own editor controls, including a real date picker, and the store requires `YYYY-MM-DD`. Meetings and events on Willow still use string dates on the page poster for `datedList`; dataset-backed rows use typed fields in `datasets/` instead.

## Known splinters we are leaving

**Legacy list bindings (`datedList`, `peopleGrid`, …) are not in the binding wizard.** Sites that still name those components edit the binding YAML directly. Blog/article listings use the reserved blog types and `bootBlog` hydration (`<script type="application/json" class="tessera-blog-data">`), not zone JSON content. Structured lists belong in **datasets** and dataset bindings.

**`fields.showIndexInNav` is one hardcoded name in the shared form reader** (`apps/editor/src/forms/form.ts`). Page fields are strings, and a checkbox on a dotted name would otherwise become a boolean, which `stringFields` drops. The blog save path rewrites `true` or `"true"` to the string `"true"` and deletes anything else. The editor branch does the same rewrite one step earlier so the draft matches. The page-level Show in nav checkbox is a real boolean and uses the normal path. This is the only boolean hiding in the string map. Leave it. A second checkbox under `fields.` should share one rule rather than add another named branch.

**Markup and behaviour are registered apart.** Screens return HTML strings. After `innerHTML`, a `bind*` function in `apps/editor/src/app.ts` attaches listeners. Hero buttons are declared in `forms/article.ts` and do nothing until `bindPickers` recognises `data-hero-pick` and its siblings. A new button compiles with no listener. Compose does not have this gap: its canvas mounts its own handlers. Missed wiring is annoying and not serious enough to rewrite the editor.

## Growth, and why we are not splitting or porting it

`apps/editor/src/app.ts` is about 4,200 lines and about 100 functions. On 6 October it was about 2,900. It owns routing, chrome actions, lists, record creation, draft sessions, undo, the library, and the edit screen. Chrome and dialogs have been extracted. A `views/` split has not. New behaviour has kept landing in `app.ts`.

Under that, the pieces that matter are already in good shape:

- The form helper (`forms/schema.ts`, `forms/form.ts`) turns a field schema into HTML and back into a record. It is small and tested.
- Binding, nav, and type forms are pure render and read functions with their own tests.
- Compose (`compose/canvas.ts`, about 1,850 lines) and arrange are imperative canvas editors. They mount themselves.

The editor has no UI framework. W3 classes in the editor are the site stylesheet used as chrome. The adaptive region skin still belongs to the published page.

A React (or similar) port would colocate a control and its handler. It would also rewrite `app.ts`, the canvases, and the binding wizard, move the article and blog branches into components unchanged, and discard a large set of HTML-string tests. Compose and arrange would stay custom DOM inside the framework. The published site would be unaffected, because the record API is the boundary. During the port the file that is hard to change would be the file being rewritten. There is no appreciable benefit now.

A later front end, if it happens, should be a new client of the existing API. Porting this editor screen by screen is not planned.

## What still works without typed fields

These do not need `datedList`'s string-date trick:

- Nav `pageType` and `linkCluster` link pages by id and title.
- `peopleGrid` and the profile components (`profileKicker`, `profilePhoto`, `profileFacts`) show title and string fields such as `role`, `photo`, and `email`.
- `articleByline` prints filled-in strings on the current page and formats `date` when the string parses.
- `pageNav` lists pages with no type. Search can filter by type id.
- Blog sorting uses the reserved article date, which is validated.
- `agendaList` and `attendeeList` read JSON rows from a zone. That is data on a page, not a query of pages by type.

No code change follows from this review.
