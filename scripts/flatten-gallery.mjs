#!/usr/bin/env node
/**
 * Scan a folder of images → first-class `folders[]` record (+ optional gallery binding).
 *
 * Usage:
 *   node scripts/flatten-gallery.mjs \
 *     --dir apps/demo-pure/public/media/sample-gallery \
 *     --id sample-gallery \
 *     --path ./media/sample-gallery \
 *     --merge apps/demo-pure/public/data/site.json
 *
 * Optional per-folder meta.json:
 *   { "title": "Sample", "captions": { "01-red.svg": "Crimson field" } }
 *
 * Captions default from filename (ordering prefix stripped) when not in meta.
 */
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

function parseArgs(argv) {
  const out = {
    dir: null,
    id: "gallery",
    pathPrefix: null,
    outPath: null,
    mergePath: null,
    component: "gallery",
    mode: "grid",
    binding: true,
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
    } else if (a === "--path" || a === "--url-prefix") {
      out.pathPrefix = next;
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
    } else if (a === "--no-binding") {
      out.binding = false;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

/** Mirror of packages/model captionFromFilename for the Node script. */
function captionFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  const withoutOrder = base.replace(/^\d+[-_.\s]+/, "");
  const spaced = (withoutOrder || base).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return filename;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function loadMeta(dir) {
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return {};
  return JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

function scanFolder(dir, folderId, pathPrefix, meta) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const captions = meta.captions && typeof meta.captions === "object" ? meta.captions : {};
  const images = entries.map((file) => {
    const override = typeof captions[file] === "string" ? captions[file] : undefined;
    const row = { file };
    if (override) {
      row.caption = override;
      row.alt = override;
    }
    return row;
  });

  return {
    folder: {
      id: folderId,
      path: pathPrefix.replace(/\/$/, ""),
      title: typeof meta.title === "string" ? meta.title : folderId,
      images,
    },
    // expose derived captions for logging
    derived: images.map((img) => ({
      file: img.file,
      caption: img.caption ?? captionFromFilename(img.file),
    })),
  };
}

function buildFragment({ folder, component, mode, withBinding }) {
  const fragment = { folders: [folder] };
  if (withBinding) {
    fragment.bindings = [
      {
        id: folder.id,
        component,
        props: { folders: [folder.id], mode },
      },
    ];
  }
  return fragment;
}

function assertFragmentShape(fragment) {
  if (!fragment.folders?.[0]?.id || !Array.isArray(fragment.folders[0].images)) {
    throw new Error("Fragment missing folder record");
  }
  if (fragment.folders[0].images.length === 0) {
    throw new Error("Folder has no images");
  }
}

function mergeIntoSite(sitePath, fragment, folderId) {
  const doc = JSON.parse(fs.readFileSync(sitePath, "utf8"));

  doc.folders = [...(doc.folders ?? []).filter((f) => f.id !== folderId), ...fragment.folders];

  if (fragment.bindings) {
    doc.bindings = [
      ...(doc.bindings ?? []).filter((b) => b.id !== folderId && b.id !== `${folderId}-slides`),
      ...fragment.bindings,
    ];
  }

  // Drop legacy bank+item gallery shape for this id if present.
  doc.media = (doc.media ?? []).filter((m) => !String(m.id).startsWith(`${folderId}-`));
  doc.items = (doc.items ?? []).filter((i) => i.id !== `${folderId}-data`);

  fs.writeFileSync(sitePath, `${JSON.stringify(doc, null, 2)}\n`);
  return doc;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dir) {
    console.log(`Usage: node scripts/flatten-gallery.mjs --dir <folder> --id <folder-id> [options]

Options:
  --path <urlPrefix>    Path stored on the folder record (default: ./media/<id>)
  --out <file>          Write fragment JSON
  --merge <site.json>   Merge folder (+ binding) into SiteDocument
  --mode grid|slides    Binding prop mode (default: grid)
  --no-binding          Emit folder only (no bindings[])
  --component <name>    Component name (default: gallery)
`);
    process.exit(args.help ? 0 : 1);
  }

  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Not a directory: ${dir}`);
    process.exit(1);
  }

  const pathPrefix = args.pathPrefix ?? `./media/${args.id}`;
  const meta = loadMeta(dir);
  const scanned = scanFolder(dir, args.id, pathPrefix, meta);
  const fragment = buildFragment({
    folder: scanned.folder,
    component: args.component,
    mode: args.mode,
    withBinding: args.binding,
  });

  assertFragmentShape(fragment);

  if (args.mergePath) {
    const mergePath = path.resolve(args.mergePath);
    const doc = mergeIntoSite(mergePath, fragment, args.id);
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
      `Flattened folder "${args.id}" (${scanned.folder.images.length} image(s))` +
        (args.mergePath ? ` → merged into ${args.mergePath}` : "") +
        (args.outPath ? ` → wrote ${args.outPath}` : ""),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
