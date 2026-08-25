#!/usr/bin/env node
/**
 * Spike: scan a folder of images → media[] + gallery item/binding fragment.
 *
 * Usage:
 *   node scripts/flatten-gallery.mjs \
 *     --dir apps/demo-pure/public/media/gallery \
 *     --id sample-gallery \
 *     --url-prefix ./media/gallery \
 *     --out /tmp/gallery-fragment.json
 *
 *   node scripts/flatten-gallery.mjs ... --merge apps/demo-pure/public/data/site.json
 *
 * Optional per-folder meta.json:
 *   { "title": "Sample", "captions": { "01-red.svg": "Red block" } }
 */
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

function parseArgs(argv) {
  const out = {
    dir: null,
    id: "gallery",
    urlPrefix: null,
    outPath: null,
    mergePath: null,
    component: "gallery",
    mode: "grid",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--dir") {
      out.dir = next;
      i++;
    } else if (a === "--id") {
      out.id = next;
      i++;
    } else if (a === "--url-prefix") {
      out.urlPrefix = next;
      i++;
    } else if (a === "--out") {
      out.outPath = next;
      i++;
    } else if (a === "--merge") {
      out.mergePath = next;
      i++;
    } else if (a === "--component") {
      out.component = next;
      i++;
    } else if (a === "--mode") {
      out.mode = next === "slides" ? "slides" : "grid";
      i++;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromFilename(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function loadMeta(dir) {
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return {};
  return JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

function scanFolder(dir, galleryId, urlPrefix, meta) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .filter((name) => name !== "meta.json")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const captions = meta.captions && typeof meta.captions === "object" ? meta.captions : {};
  const media = [];
  const mediaIds = [];

  entries.forEach((filename, index) => {
    const base = slugify(filename) || `img-${index + 1}`;
    const id = `${galleryId}-${base}`;
    const caption =
      typeof captions[filename] === "string"
        ? captions[filename]
        : typeof captions[base] === "string"
          ? captions[base]
          : titleFromFilename(filename);
    media.push({
      id,
      title: caption,
      caption,
      url: `${urlPrefix.replace(/\/$/, "")}/${filename}`,
      type: "image",
      alt: caption,
      sort: index + 1,
    });
    mediaIds.push(id);
  });

  return { media, mediaIds, title: typeof meta.title === "string" ? meta.title : galleryId };
}

function buildFragment({ galleryId, component, mode, media, mediaIds, title }) {
  const itemId = `${galleryId}-data`;
  const bindingId = galleryId;
  return {
    media,
    items: [
      {
        id: itemId,
        title: `${title} (data)`,
        tags: ["gallery"],
        zones: {
          slides: [{ type: "json", data: mediaIds }],
        },
      },
    ],
    bindings: [
      {
        id: bindingId,
        component,
        itemId,
        fromZone: "slides",
        props: { mode },
      },
    ],
  };
}

function assertFragmentShape(fragment) {
  if (!Array.isArray(fragment.media) || fragment.media.length === 0) {
    throw new Error("Fragment has no media entries");
  }
  for (const m of fragment.media) {
    if (!m.id || !m.url) throw new Error(`Invalid media row: ${JSON.stringify(m)}`);
  }
  if (!fragment.items?.[0]?.zones?.slides) {
    throw new Error("Fragment missing gallery item slides zone");
  }
  if (!fragment.bindings?.[0]?.id || !fragment.bindings[0].component) {
    throw new Error("Fragment missing binding");
  }
}

function mergeIntoSite(sitePath, fragment, galleryId) {
  const doc = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  const itemId = `${galleryId}-data`;

  doc.media = [...(doc.media ?? []).filter((m) => !String(m.id).startsWith(`${galleryId}-`)), ...fragment.media];
  doc.items = [...(doc.items ?? []).filter((i) => i.id !== itemId), ...fragment.items];
  doc.bindings = [
    ...(doc.bindings ?? []).filter((b) => b.id !== galleryId),
    ...fragment.bindings,
  ];

  fs.writeFileSync(sitePath, `${JSON.stringify(doc, null, 2)}\n`);
  return doc;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dir) {
    console.log(`Usage: node scripts/flatten-gallery.mjs --dir <folder> --id <gallery-id> [options]

Options:
  --url-prefix <path>   URL prefix for media urls (default: ./media/<id>)
  --out <file>          Write fragment JSON
  --merge <site.json>   Merge media/item/binding into an existing SiteDocument
  --mode grid|slides    Binding prop mode (default: grid)
  --component <name>    Component name (default: gallery)
`);
    process.exit(args.help ? 0 : 1);
  }

  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Not a directory: ${dir}`);
    process.exit(1);
  }

  const urlPrefix = args.urlPrefix ?? `./media/${args.id}`;
  const meta = loadMeta(dir);
  const scanned = scanFolder(dir, args.id, urlPrefix, meta);
  const fragment = buildFragment({
    galleryId: args.id,
    component: args.component,
    mode: args.mode,
    media: scanned.media,
    mediaIds: scanned.mediaIds,
    title: scanned.title,
  });

  assertFragmentShape(fragment);

  if (args.mergePath) {
    const mergePath = path.resolve(args.mergePath);
    const doc = mergeIntoSite(mergePath, fragment, args.id);
    // Soft schema check when merge target is available to vitest/tests;
    // runtime Node cannot import the TS package entry without a loader.
    if (!doc.version || !doc.site || !Array.isArray(doc.pages)) {
      throw new Error(`Merged file does not look like a SiteDocument: ${mergePath}`);
    }
  }

  if (args.outPath) {
    fs.writeFileSync(path.resolve(args.outPath), `${JSON.stringify(fragment, null, 2)}\n`);
  }

  if (!args.outPath && !args.mergePath) {
    console.log(JSON.stringify(fragment, null, 2));
  } else {
    console.log(
      `Flattened ${fragment.media.length} image(s) as gallery "${args.id}"` +
        (args.mergePath ? ` → merged into ${args.mergePath}` : "") +
        (args.outPath ? ` → wrote ${args.outPath}` : ""),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
