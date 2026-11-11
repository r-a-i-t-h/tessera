#!/usr/bin/env node
/**
 * Build demo/datasets-demo-site/ and demo/datasets-demo.tar.gz for manual import.
 * Not shipped in the Tessera release (see demo/README.md).
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const seedTheme = join(repoRoot, "apps/editor-api/seed/themes/tessera-w3-starter");
const outDir = join(here, "datasets-demo-site");
const archive = join(here, "datasets-demo.tar.gz");

const TS = "2026-11-01T12:00:00.000Z";

function datasetPeople() {
  return {
    id: "people",
    title: "People",
    view: { columns: ["name", "role", "email", "manager"], displayName: "{name}" },
    schema: {
      fields: [
        { key: "f1", id: "name", label: "Name", kind: "string", required: true },
        { key: "f2", id: "role", label: "Role", kind: "string" },
        { key: "f3", id: "email", label: "Email", kind: "string" },
        {
          key: "f4",
          id: "manager",
          label: "Manager",
          kind: "ref",
          dataset: "people",
        },
      ],
    },
    nextUid: 6,
    records: [
      {
        uid: 1,
        page: "jordan-lee",
        added: TS,
        modified: TS,
        name: "Jordan Lee",
        role: "Engineering lead",
        email: "jordan@example.com",
      },
      {
        uid: 2,
        added: TS,
        modified: TS,
        name: "Sam Rivera",
        role: "Designer",
        email: "sam@example.com",
      },
      {
        uid: 3,
        added: TS,
        modified: TS,
        name: "Alex Chen",
        role: "Developer",
        email: "alex@example.com",
        manager: 1,
      },
      {
        uid: 4,
        added: TS,
        modified: TS,
        name: "Morgan Patel",
        role: "Product manager",
        email: "morgan@example.com",
        manager: 1,
      },
      {
        uid: 5,
        added: TS,
        modified: TS,
        name: "Quinn Okonkwo",
        role: "Support",
        email: "quinn@example.com",
      },
    ],
  };
}

function datasetProducts() {
  return {
    id: "products",
    title: "Products",
    view: {
      columns: ["name", "category", "price", "inStock"],
      displayName: "{name}",
    },
    schema: {
      fields: [
        { key: "f1", id: "name", label: "Name", kind: "string", required: true },
        {
          key: "f2",
          id: "category",
          label: "Category",
          kind: "enum",
          options: [
            { value: "electronics", label: "Electronics" },
            { value: "accessories", label: "Accessories" },
          ],
        },
        { key: "f3", id: "price", label: "Price", kind: "number" },
        { key: "f4", id: "inStock", label: "In stock", kind: "boolean" },
        { key: "f5", id: "blurb", label: "Description", kind: "text" },
      ],
    },
    nextUid: 5,
    records: [
      {
        uid: 1,
        page: "orchard-tablet",
        added: TS,
        modified: TS,
        name: "Orchard Tablet",
        category: "electronics",
        price: 499,
        inStock: true,
        blurb: "<p>Lightweight tablet for field notes and sketching.</p>",
      },
      {
        uid: 2,
        added: TS,
        modified: TS,
        name: "Harbor Keyboard",
        category: "accessories",
        price: 89,
        inStock: true,
        blurb: "<p>Mechanical keyboard with quiet switches.</p>",
      },
      {
        uid: 3,
        added: TS,
        modified: TS,
        name: "Summit Monitor",
        category: "electronics",
        price: 320,
        inStock: false,
        blurb: "<p>27-inch display, colour-calibrated.</p>",
      },
      {
        uid: 4,
        added: TS,
        modified: TS,
        name: "Meadow Headphones",
        category: "accessories",
        price: 149,
        inStock: true,
        blurb: "<p>Over-ear headphones with long battery life.</p>",
      },
    ],
  };
}

function datasetMeetings() {
  return {
    id: "meetings",
    title: "Meetings",
    view: {
      columns: ["title", "heldOn", "location", "chair"],
      displayName: "{title} ({heldOn})",
    },
    schema: {
      fields: [
        { key: "f1", id: "title", label: "Title", kind: "string", required: true },
        { key: "f2", id: "heldOn", label: "Held on", kind: "date", required: true },
        { key: "f3", id: "location", label: "Location", kind: "string" },
        { key: "f4", id: "chair", label: "Chair", kind: "ref", dataset: "people" },
        {
          key: "f5",
          id: "attendees",
          label: "Attendees",
          kind: "ref",
          dataset: "people",
          many: true,
        },
        { key: "f6", id: "notes", label: "Notes", kind: "text" },
      ],
    },
    nextUid: 4,
    records: [
      {
        uid: 1,
        page: "spring-planning",
        added: TS,
        modified: TS,
        title: "Spring planning",
        heldOn: "2026-04-15",
        location: "Conference room A",
        chair: 1,
        attendees: [1, 2, 3, 4],
        notes: "<p>Quarterly roadmap and staffing.</p>",
      },
      {
        uid: 2,
        added: TS,
        modified: TS,
        title: "Weekly sync",
        heldOn: "2026-11-12",
        location: "Virtual",
        chair: 4,
        attendees: [1, 3, 4],
      },
      {
        uid: 3,
        added: TS,
        modified: TS,
        title: "Product review",
        heldOn: "2026-12-01",
        location: "Lab",
        chair: 4,
        attendees: [2, 4, 5],
        notes: "<p>Demo new hardware prototypes.</p>",
      },
    ],
  };
}

const bindings = {
  "all-products": {
    component: "datasetTable",
    props: {
      dataset: "products",
      fields: ["name", "category", "price", "inStock"],
      sort: { field: "price", dir: "desc" },
      interactiveSort: true,
    },
  },
  "all-people": {
    component: "datasetCards",
    props: {
      dataset: "people",
      fields: ["name", "role", "email"],
      headingField: "name",
    },
  },
  "all-meetings": {
    component: "datasetPlainList",
    props: {
      dataset: "meetings",
      fields: ["title", "heldOn", "location"],
      sort: { field: "heldOn", dir: "desc" },
    },
  },
  "page-product": {
    component: "datasetCards",
    props: {
      dataset: "products",
      pageData: true,
      fields: ["name", "category", "price", "inStock", "blurb"],
      headingField: "name",
    },
  },
  "page-meeting": {
    component: "datasetTable",
    props: {
      dataset: "meetings",
      pageData: true,
      fields: ["title", "heldOn", "location", "chair", "attendees", "notes"],
    },
  },
  "page-person": {
    component: "datasetCards",
    props: {
      dataset: "people",
      pageData: true,
      fields: ["name", "role", "email", "manager"],
      headingField: "name",
    },
  },
  "people-org-chart": {
    component: "runtimeModule",
    props: {
      dataset: "people",
      module: "demo-org-chart",
    },
  },
  "meetings-roster-module": {
    component: "runtimeModule",
    props: {
      dataset: "meetings",
      module: "demo-meetings-roster",
    },
  },
};

const pages = {
  home: {
    id: "home",
    title: "Dataset demo",
    type: "standard",
    zones: {
      title: { html: "Dataset demo" },
      main: {
        html: `<p>This mini-site exercises Tessera datasets and bindings. Data lives in <code>datasets/*.json</code>; pages pull it in through bindings.</p>
<ul>
  <li><strong>Global bindings</strong> list every row in a dataset (or apply filters on the binding).</li>
  <li><strong>Page data</strong> bindings only show records whose <code>page</code> metadata matches the current page id.</li>
</ul>
<p>Some records use <code>ref</code> fields across datasets (meetings → people). Publish embeds referenced rows for drill-down.</p>
<p><strong>Runtime modules</strong> receive one primary dataset per binding; Tessera walks <code>ref</code> fields and packs every reached row into <code>ctx.dataset.records</code> (see the Meetings page).</p>
<h2>Products (global table)</h2>
{{all-products}}
<h2>People (global cards)</h2>
{{all-people}}
<h2>Meetings (global list)</h2>
{{all-meetings}}`,
      },
    },
  },
  products: {
    id: "products",
    title: "Product catalog",
    type: "standard",
    zones: {
      title: { html: "Product catalog" },
      main: {
        html: `<p>Global product table with interactive sort by price.</p>
{{all-products}}`,
      },
    },
  },
  "orchard-tablet": {
    id: "orchard-tablet",
    title: "Orchard Tablet",
    type: "standard",
    zones: {
      title: { html: "Orchard Tablet" },
      main: {
        html: `<p>The <strong>Orchard Tablet</strong> row in <code>products</code> is linked to this page id. The first binding uses <em>page data</em>; the second is global.</p>
<h2>This product (page data)</h2>
{{page-product}}
<h2>Full catalog (global)</h2>
{{all-products}}`,
      },
    },
  },
  meetings: {
    id: "meetings",
    title: "Meetings",
    type: "standard",
    zones: {
      title: { html: "Meetings" },
      main: {
        html: `<p>Meetings reference people as chair and attendees. Ref targets are included when the site is flattened.</p>
<h2>Runtime module (meetings + walked people)</h2>
{{meetings-roster-module}}
<h2>Catalogue list</h2>
{{all-meetings}}
<h2>Tabular view</h2>
{{all-meetings-table}}`,
      },
    },
  },
  "spring-planning": {
    id: "spring-planning",
    title: "Spring planning",
    type: "standard",
    zones: {
      title: { html: "Spring planning" },
      main: {
        html: `<p>Only the <strong>Spring planning</strong> meeting record points at this page.</p>
<h2>This meeting (page data)</h2>
{{page-meeting}}
<h2>All meetings (global)</h2>
{{all-meetings}}`,
      },
    },
  },
  people: {
    id: "people",
    title: "People",
    type: "standard",
    zones: {
      title: { html: "People" },
      main: {
        html: `<p>Team directory with optional manager self-references.</p>
<h2>Runtime module org chart</h2>
{{people-org-chart}}
<h2>Cards view</h2>
{{all-people}}`,
      },
    },
  },
  "jordan-lee": {
    id: "jordan-lee",
    title: "Jordan Lee",
    type: "standard",
    zones: {
      title: { html: "Jordan Lee" },
      main: {
        html: `<p>Jordan's person record is exclusive to this page.</p>
<h2>This person (page data)</h2>
{{page-person}}
<h2>Everyone (global)</h2>
{{all-people}}`,
      },
    },
  },
  search: {
    id: "search",
    title: "Search",
    type: "search",
    zones: { title: { html: "Search" } },
  },
};

// Extra binding used only on meetings page
bindings["all-meetings-table"] = {
  component: "datasetTable",
  props: {
    dataset: "meetings",
    fields: ["title", "heldOn", "location", "chair"],
    sort: { field: "heldOn", dir: "asc" },
  },
};

async function writeYaml(path, obj) {
  const { stringify } = await import("yaml");
  await writeFile(path, stringify(obj));
}

async function runTar(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar exited ${code}`));
    });
  });
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "meta.json"), JSON.stringify({ schemaVersion: 1 }, null, 2) + "\n");

  const shellDir = join(outDir, "shell");
  const themeShell = join(seedTheme, "shell");
  await mkdir(shellDir, { recursive: true });
  for (const name of ["index.html", "site.css", "local.css"]) {
    await cp(join(themeShell, name), join(shellDir, name));
  }
  const shellIndex = join(shellDir, "index.html");
  let html = await (await import("node:fs/promises")).readFile(shellIndex, "utf8");
  html = html.replace("<title>New site</title>", "<title>Dataset demo</title>");
  await writeFile(shellIndex, html);

  const records = join(outDir, "records");
  await mkdir(join(records, "content"), { recursive: true });
  await mkdir(join(records, "bindings"), { recursive: true });
  await mkdir(join(records, "layouts"), { recursive: true });
  await mkdir(join(records, "types"), { recursive: true });
  await mkdir(join(records, "items"), { recursive: true });

  await writeYaml(join(records, "site.yaml"), {
    version: 2,
    id: "datasets-demo",
    title: "Dataset demo",
    homePageId: "home",
    defaultLayoutId: "standard",
    masterLayoutId: "master",
    delivery: "pages",
    style: { navSide: "left" },
  });

  for (const [name, body] of Object.entries(pages)) {
    await writeYaml(join(records, "content", `${name}.yaml`), body);
  }
  await writeFile(
    join(records, "content", "_order.yaml"),
    [
      "home",
      "products",
      "orchard-tablet",
      "meetings",
      "spring-planning",
      "people",
      "jordan-lee",
      "search",
    ]
      .map((id) => `- ${id}`)
      .join("\n") + "\n",
  );

  for (const [id, body] of Object.entries(bindings)) {
    await writeYaml(join(records, "bindings", `${id}.yaml`), { id, ...body });
  }

  await cp(join(seedTheme, "records/layouts"), join(records, "layouts"), { recursive: true });
  await cp(join(seedTheme, "records/items"), join(records, "items"), { recursive: true });
  await writeFile(
    join(records, "layouts", "search.yaml"),
    `id: search
root:
  type: region
  children:
    - type: region
      tag: h1
      children:
        - type: zone
          id: title
    - type: component
      name: searchResults
`,
  );
  await writeFile(join(records, "layouts", "_order.yaml"), "- standard\n- search\n- master\n");
  await writeFile(join(records, "items", "_order.yaml"), "- common-footer\n");

  await writeYaml(join(records, "types", "standard.yaml"), { id: "standard", layoutId: "standard" });
  await writeYaml(join(records, "types", "search.yaml"), { id: "search", layoutId: "search" });
  await writeFile(join(records, "types", "_order.yaml"), "- standard\n- search\n");

  const footerPath = join(records, "items", "common-footer.yaml");
  const { readFile } = await import("node:fs/promises");
  let footer = await readFile(footerPath, "utf8");
  footer = footer.replace(/New site/g, "Dataset demo");
  await writeFile(footerPath, footer);

  await writeFile(
    join(records, "nav.yaml"),
    [
      "- id: home",
      "  title: Overview",
      "  sidebar: true",
      "- id: products",
      "  title: Products",
      "  sidebar: true",
      "- id: orchard-tablet",
      "  title: Orchard Tablet",
      "  sidebar: true",
      "- id: meetings",
      "  title: Meetings",
      "  sidebar: true",
      "- id: spring-planning",
      "  title: Spring planning",
      "  sidebar: true",
      "- id: people",
      "  title: People",
      "  sidebar: true",
      "- id: jordan-lee",
      "  title: Jordan Lee",
      "  sidebar: true",
      "- id: search",
      "  title: Search",
      "  sidebar: true",
    ].join("\n") + "\n",
  );

  const datasetsDir = join(outDir, "datasets");
  await mkdir(datasetsDir, { recursive: true });
  for (const file of [datasetPeople(), datasetProducts(), datasetMeetings()]) {
    await writeFile(join(datasetsDir, `${file.id}.json`), JSON.stringify(file, null, 2) + "\n");
  }

  const runtimeSrc = join(here, "runtime-modules");
  const runtimeDest = join(outDir, "runtime-modules");
  await cp(runtimeSrc, runtimeDest, { recursive: true });
  const runtimeRecords = join(records, "runtime-modules");
  await mkdir(runtimeRecords, { recursive: true });
  for (const mod of [
    { id: "demo-org-chart", title: "Demo org chart (people)" },
    { id: "demo-meetings-roster", title: "Demo meetings roster (multi-dataset walk)" },
  ]) {
    await writeYaml(join(runtimeRecords, `${mod.id}.yaml`), { id: mod.id, ext: "js", title: mod.title });
  }

  await rm(archive, { force: true });
  const partial = `${archive}.partial`;
  await runTar([
    "-czf",
    partial,
    "--exclude=users",
    "--exclude=history",
    "--exclude=node_modules",
    "--exclude=backup",
    "-C",
    outDir,
    ".",
  ]);
  await (await import("node:fs/promises")).rename(partial, archive);

  console.log(`Wrote ${outDir}`);
  console.log(`Wrote ${archive}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
