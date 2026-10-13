import { readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

type ContentPage = {
  id: string;
  title?: string;
  slug?: string;
  parentId?: string;
  type?: string;
  fields?: Record<string, string>;
  zones?: Record<string, unknown>;
  tags?: string[];
  [key: string]: unknown;
};

function tenantOf(page: ContentPage): string {
  return page.fields?.tenant?.trim() ?? "";
}

function cloneBlogFromTemplate(template: ContentPage, tenantId: string): ContentPage {
  const fields = { ...(template.fields ?? {}) };
  delete fields.tenant;
  const title = template.title?.trim() || tenantId;
  return {
    ...template,
    id: tenantId,
    title,
    slug: tenantId,
    type: "blog",
    fields,
    zones: template.zones ? structuredClone(template.zones) : {},
  };
}

function indexForBlog(blogId: string): ContentPage {
  return {
    id: `${blogId}-index`,
    title: "Index",
    slug: "index",
    parentId: blogId,
    type: "blog-index",
    zones: { title: { html: "Index" } },
  };
}

function rewriteNavEntryId(entries: unknown[], from: string, to: string): unknown[] {
  const out: unknown[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      out.push(entry);
      continue;
    }
    const row = entry as Record<string, unknown>;
    const next = { ...row, ...(row.id === from ? { id: to } : {}) };
    if (Array.isArray(row.children)) next.children = rewriteNavEntryId(row.children, from, to);
    out.push(next);
  }
  return out;
}

async function readContentDir(recordsDir: string): Promise<Map<string, ContentPage>> {
  const dir = join(recordsDir, "content");
  const map = new Map<string, ContentPage>();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return map;
  }
  for (const file of files) {
    if (!file.endsWith(".yaml") || file === "_order.yaml") continue;
    const id = file.slice(0, -5);
    const text = await readFile(join(dir, file), "utf8");
    const parsed = parseYaml(text) as ContentPage;
    if (parsed && typeof parsed === "object") map.set(id, { ...parsed, id });
  }
  return map;
}

async function writeContentPage(recordsDir: string, page: ContentPage): Promise<void> {
  const { id, ...rest } = page;
  const body = stringifyYaml({ id, ...rest });
  await writeFile(join(recordsDir, "content", `${id}.yaml`), body.endsWith("\n") ? body : `${body}\n`);
}

async function readTenantOrder(recordsDir: string): Promise<string[]> {
  try {
    const parsed = parseYaml(await readFile(join(recordsDir, "tenants", "_order.yaml"), "utf8"));
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // no order file
  }
  try {
    const files = await readdir(join(recordsDir, "tenants"));
    return files.filter((f) => f.endsWith(".yaml") && f !== "_order.yaml").map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

/** Rewrite tenant-based blogs to parentId-based streams. Removes records/tenants. */
export async function migrateRemoveTenants(dataDir: string): Promise<void> {
  const recordsDir = join(dataDir, "records");
  const content = await readContentDir(recordsDir);
  const pages = [...content.values()];
  const tenantOrder = await readTenantOrder(recordsDir);
  const tenantIds = new Set(tenantOrder);
  for (const page of pages) {
    if (page.type === "article") {
      const tenant = tenantOf(page);
      if (tenant) tenantIds.add(tenant);
    }
  }

  const blogsByTenant = new Map<string, ContentPage>();
  for (const page of pages) {
    if (page.type !== "blog") continue;
    const tenant = tenantOf(page);
    if (!tenant) continue;
    if (blogsByTenant.has(tenant)) {
      throw new Error(`Two blogs name tenant ${tenant}.`);
    }
    blogsByTenant.set(tenant, page);
  }

  const unscopedBlogs = pages.filter((page) => page.type === "blog" && !tenantOf(page));
  if (unscopedBlogs.length > 1) throw new Error("Only one unscoped blog may exist before migration.");

  const articles = pages.filter((page) => page.type === "article");
  for (const article of articles) {
    const tenant = tenantOf(article);
    if (tenant && !tenantIds.has(tenant)) {
      throw new Error(`Article ${article.id} names tenant ${tenant}, which is not a tenant record.`);
    }
  }

  const tenantsToProcess = tenantOrder.length ? tenantOrder : [...tenantIds].sort();
  const createdBlogIds = new Set<string>();
  const navRewrites: { from: string; to: string }[] = [];

  for (const tenantId of tenantsToProcess) {
    let blog = blogsByTenant.get(tenantId);
    if (blog && blog.id !== tenantId) {
      if (content.has(tenantId)) throw new Error(`Cannot rekey blog ${blog.id} to ${tenantId}: id already used.`);
      const oldId = blog.id;
      const oldIndexId = `${oldId}-index`;
      blog = { ...blog, id: tenantId, slug: blog.slug === oldId ? tenantId : blog.slug };
      content.delete(oldId);
      content.set(tenantId, blog);
      const oldIndex = content.get(oldIndexId);
      if (oldIndex) {
        content.delete(oldIndexId);
        content.set(`${tenantId}-index`, { ...oldIndex, id: `${tenantId}-index`, parentId: tenantId });
      }
      blogsByTenant.set(tenantId, blog);
      navRewrites.push({ from: oldId, to: tenantId });
    } else if (!blog && unscopedBlogs[0]) {
      const template = unscopedBlogs[0];
      blog = cloneBlogFromTemplate(template, tenantId);
      content.set(tenantId, blog);
      if (!content.has(`${tenantId}-index`)) {
        content.set(`${tenantId}-index`, indexForBlog(tenantId));
      }
      createdBlogIds.add(tenantId);
    } else if (!blog) {
      continue;
    } else {
      const fields = { ...(blog.fields ?? {}) };
      delete fields.tenant;
      blog = { ...blog, fields };
      content.set(tenantId, blog);
    }
    createdBlogIds.add(tenantId);
  }

  for (const article of articles) {
    const tenant = tenantOf(article);
    if (!tenant) throw new Error(`Article ${article.id} has no tenant field.`);
    const targetBlogId = blogsByTenant.get(tenant)?.id ?? tenant;
    if (!content.has(targetBlogId)) {
      throw new Error(`Article ${article.id} has no migrated blog for tenant ${tenant}.`);
    }
    const fields = { ...(article.fields ?? {}) };
    delete fields.tenant;
    const next = { ...article, parentId: targetBlogId, fields };
    content.set(article.id, next);
  }

  for (const unscoped of unscopedBlogs) {
    const stillUsed = [...content.values()].some(
      (page) => page.type === "article" && page.parentId === unscoped.id,
    );
    if (stillUsed) throw new Error(`Unscoped blog ${unscoped.id} still has articles after migration.`);
    content.delete(unscoped.id);
    content.delete(`${unscoped.id}-index`);
  }

  for (const page of [...content.values()]) {
    if (page.type === "blog") {
      const fields = { ...(page.fields ?? {}) };
      delete fields.tenant;
      content.set(page.id, { ...page, fields });
    }
  }

  const navPath = join(recordsDir, "nav.yaml");
  let nav: unknown[] | undefined;
  try {
    const parsed = parseYaml(await readFile(navPath, "utf8"));
    nav = Array.isArray(parsed) ? parsed : [];
  } catch {
    nav = undefined;
  }

  if (nav) {
    if (unscopedBlogs[0] && createdBlogIds.size) {
      const first = tenantsToProcess.find((id) => createdBlogIds.has(id));
      if (first) navRewrites.push({ from: unscopedBlogs[0].id, to: first });
    }
    for (const { from, to } of navRewrites) {
      nav = rewriteNavEntryId(nav, from, to);
    }
  }

  for (const page of content.values()) {
    await writeContentPage(recordsDir, page);
  }
  for (const id of pages.map((p) => p.id)) {
    if (!content.has(id)) {
      await unlink(join(recordsDir, "content", `${id}.yaml`)).catch(() => undefined);
    }
  }

  if (nav) {
    const body = stringifyYaml(nav);
    await writeFile(navPath, body.endsWith("\n") ? body : `${body}\n`);
  }

  await rm(join(recordsDir, "tenants"), { recursive: true, force: true });

  const metaPath = join(dataDir, "meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
  meta.schemaVersion = 3;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}
