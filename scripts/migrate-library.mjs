#!/usr/bin/env node
/**
 * Turn records/media urls and records/folders image lists into the library.
 * Blobs are copied to files/<id>.<ext>. Image thumbnails are written beside them.
 * Existing publish/media/<id>.<ext> copies are updated when publish/ is present.
 */
import fs from "node:fs";
import path from "node:path";

const data = path.resolve(process.argv[2] || process.env.TESSERA_DATA || "");
if (!data) {
  console.error("migrate-library: pass the site directory");
  process.exit(1);
}

const records = path.join(data, "records");
const filesDir = path.join(data, "files");
const publishMedia = path.join(data, "publish", "media");

function readYaml(file) {
  const text = fs.readFileSync(file, "utf8");
  const record = {};
  let key = null;
  let list = null;
  const images = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const image = /^ {2}- file: (.+)$/.exec(line);
    if (image) {
      list = {};
      images.push(list);
      list.file = unquote(image[1]);
      continue;
    }
    const nested = /^ {4}(\w+): (.*)$/.exec(line);
    if (nested && list) {
      list[nested[1]] = unquote(nested[2]);
      continue;
    }
    const field = /^(\w+):(?: (.*))?$/.exec(line);
    if (field) {
      key = field[1];
      list = null;
      if (field[2] !== undefined && field[2] !== "") record[key] = unquote(field[2]);
    }
  }
  if (images.length) record.images = images;
  return record;
}

function unquote(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function yamlScalar(value) {
  const text = String(value);
  if (text === "" || /[:#\n&*!|>'"%@`]/.test(text) || text.startsWith(" ")) return JSON.stringify(text);
  return text;
}

function writeRecord(file, record) {
  const lines = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: ${typeof value === "number" ? value : yamlScalar(value)}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function listYaml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") && !name.startsWith("_"))
    .map((name) => path.join(dir, name));
}

function extOf(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

function resolveBlob(url) {
  if (typeof url !== "string") return null;
  const rel = url.replace(/^\.\//, "");
  const fromPublish = path.join(data, "publish", rel);
  if (fs.existsSync(fromPublish)) return fromPublish;
  return null;
}

function copyBlob(source, id, ext) {
  if (!source || !fs.existsSync(source)) return false;
  fs.mkdirSync(filesDir, { recursive: true });
  const dest = path.join(filesDir, `${id}.${ext}`);
  fs.copyFileSync(source, dest);
  if (fs.existsSync(path.dirname(publishMedia))) {
    fs.mkdirSync(publishMedia, { recursive: true });
    fs.copyFileSync(source, path.join(publishMedia, `${id}.${ext}`));
  }
  return true;
}

async function thumb(id) {
  const source = path.join(filesDir, `${id}.${extFor(id)}`);
  if (!fs.existsSync(source)) return;
  try {
    const sharp = (await import("sharp")).default;
    await sharp(source).resize(320, 320, { fit: "inside", withoutEnlargement: true }).webp().toFile(path.join(filesDir, `${id}.thumb.webp`));
  } catch (err) {
    console.error(`migrate-library: no thumbnail for ${id}: ${err instanceof Error ? err.message : err}`);
  }
}

const extById = new Map();
function extFor(id) {
  return extById.get(id) ?? "bin";
}

const taken = new Set();
for (const file of [...listYaml(path.join(records, "media")), ...listYaml(path.join(records, "folders"))]) {
  taken.add(path.basename(file, ".yaml"));
}

function uniqueId(base) {
  let id = base || "file";
  if (!taken.has(id)) {
    taken.add(id);
    return id;
  }
  let n = 2;
  while (taken.has(`${id}-${n}`)) n += 1;
  id = `${id}-${n}`;
  taken.add(id);
  return id;
}

const imageJobs = [];

for (const file of listYaml(path.join(records, "folders"))) {
  const row = readYaml(file);
  if (typeof row.path !== "string" || !row.path) continue;
  const id = path.basename(file, ".yaml");
  const images = Array.isArray(row.images) ? row.images : [];
  images.forEach((image, sort) => {
    if (!image.file) return;
    const ext = extOf(image.file);
    if (!ext) return;
    const assetId = uniqueId(image.file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+/, "") || "file");
    const source = resolveBlob(`${row.path.replace(/\/$/, "")}/${image.file}`);
    copyBlob(source, assetId, ext);
    extById.set(assetId, ext);
    if (ext !== "pdf") imageJobs.push(assetId);
    writeRecord(path.join(records, "media", `${assetId}.yaml`), {
      id: assetId,
      name: image.file,
      kind: ext === "pdf" ? "document" : "image",
      ext,
      folderId: id,
      ...(image.caption ? { caption: image.caption } : {}),
      ...(image.alt ? { alt: image.alt } : {}),
      sort,
    });
  });
  writeRecord(file, { id, ...(row.title ? { title: row.title } : {}) });
}

for (const file of listYaml(path.join(records, "media"))) {
  const row = readYaml(file);
  if (row.kind === "image" || row.kind === "document") continue;
  if (typeof row.url !== "string") continue;
  const id = path.basename(file, ".yaml");
  const filename = path.basename(row.url);
  const ext = extOf(filename);
  if (!ext) continue;
  const parts = row.url.replace(/^\.\//, "").split("/");
  parts.shift();
  parts.pop();
  let parent;
  for (const segment of parts) {
    const folderId = segment.toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "folder";
    const folderFile = path.join(records, "folders", `${folderId}.yaml`);
    if (!fs.existsSync(folderFile)) {
      writeRecord(folderFile, { id: folderId, title: segment, ...(parent ? { parentId: parent } : {}) });
      taken.add(folderId);
    }
    parent = folderId;
  }
  copyBlob(resolveBlob(row.url), id, ext);
  extById.set(id, ext);
  if (ext !== "pdf") imageJobs.push(id);
  writeRecord(file, {
    id,
    name: filename,
    kind: ext === "pdf" ? "document" : "image",
    ext,
    ...(parent ? { folderId: parent } : {}),
    ...(row.title ? { title: row.title } : {}),
    ...(row.alt ? { alt: row.alt } : {}),
    ...(row.caption ? { caption: row.caption } : {}),
    ...(row.sort !== undefined ? { sort: Number(row.sort) } : {}),
  });
}

for (const id of imageJobs) await thumb(id);
console.log(`migrate-library: ${imageJobs.length} image(s) in ${data}`);
