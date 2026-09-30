#!/usr/bin/env node
/**
 * Import an on-disk image folder into the library.
 *
 *   node scripts/flatten-gallery.mjs --dir <images> --id <folder-id> --data <site-dir>
 *
 * Copies each image into <site-dir>/files/<id>.<ext> and writes
 * records/folders/<id>.yaml plus one records/media/<id>.yaml per file.
 * Optional meta.json in the source folder supplies title and captions.
 */
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

function parseArgs(argv) {
  const out = { dir: null, id: "gallery", data: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--dir") {
      out.dir = next;
      i++;
    } else if (a === "--id") {
      out.id = next;
      i++;
    } else if (a === "--data") {
      out.data = next;
      i++;
    } else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function captionFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  const withoutOrder = base.replace(/^\d+[-_.\s]+/, "");
  const spaced = (withoutOrder || base).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return filename;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slug(filename) {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+/, "");
  return base && /^[a-z0-9]/i.test(base) ? base.slice(0, 80) : "file";
}

function yamlScalar(value) {
  const text = String(value);
  if (text === "" || /[:#\n&*!|>'"%@`]/.test(text) || text.startsWith(" ") || text.startsWith("{") || text.startsWith("[")) {
    return JSON.stringify(text);
  }
  return text;
}

function writeYaml(file, record) {
  const lines = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: ${typeof value === "number" ? value : yamlScalar(value)}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dir || !args.data) {
    console.log(`Usage: node scripts/flatten-gallery.mjs --dir <folder> --id <folder-id> --data <site-dir>`);
    process.exit(args.help ? 0 : 1);
  }
  const dir = path.resolve(args.dir);
  const data = path.resolve(args.data);
  const metaPath = path.join(dir, "meta.json");
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  const captions = meta.captions && typeof meta.captions === "object" ? meta.captions : {};
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXT.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!names.length) {
    console.error("Folder has no images");
    process.exit(1);
  }
  const taken = new Set();
  const mediaDir = path.join(data, "records", "media");
  if (fs.existsSync(mediaDir)) {
    for (const name of fs.readdirSync(mediaDir)) {
      if (name.endsWith(".yaml")) taken.add(name.replace(/\.yaml$/, ""));
    }
  }
  writeYaml(path.join(data, "records", "folders", `${args.id}.yaml`), {
    id: args.id,
    title: typeof meta.title === "string" ? meta.title : args.id,
  });
  let sort = 0;
  for (const name of names) {
    let id = slug(name);
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    taken.add(id);
    const ext = path.extname(name).slice(1).toLowerCase().replace("jpeg", "jpg");
    fs.mkdirSync(path.join(data, "files"), { recursive: true });
    fs.copyFileSync(path.join(dir, name), path.join(data, "files", `${id}.${ext}`));
    const caption = typeof captions[name] === "string" ? captions[name] : captionFromFilename(name);
    writeYaml(path.join(data, "records", "media", `${id}.yaml`), {
      id,
      name,
      kind: "image",
      ext,
      folderId: args.id,
      caption,
      alt: caption,
      sort,
    });
    sort += 1;
  }
  console.log(`Imported ${names.length} image(s) into ${args.id}`);
}

main();
