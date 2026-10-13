import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateRemoveTenants } from "../src/migrations/remove-tenants.js";
import { parse as parseYaml } from "yaml";

describe("migrate remove tenants", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  async function seedWillowLike(): Promise<void> {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-migrate-003-"));
    await writeFile(join(dataDir, "meta.json"), `${JSON.stringify({ schemaVersion: 2 }, null, 2)}\n`);
    const records = join(dataDir, "records");
    await mkdir(join(records, "content"), { recursive: true });
    await mkdir(join(records, "tenants"), { recursive: true });
    await writeFile(
      join(records, "tenants", "_order.yaml"),
      `- hall
- admin
`,
    );
    await writeFile(join(records, "tenants", "hall.yaml"), "id: hall\n");
    await writeFile(join(records, "tenants", "admin.yaml"), "id: admin\n");
    await writeFile(
      join(records, "content", "news.yaml"),
      `id: news
title: News
type: blog
fields:
  pageSize: "10"
zones:
  title:
    html: News
`,
    );
    await writeFile(
      join(records, "content", "news-index.yaml"),
      `id: news-index
title: Index
parentId: news
type: blog-index
`,
    );
    await writeFile(
      join(records, "content", "fair.yaml"),
      `id: fair
title: Fair
type: article
parentId: news
fields:
  tenant: hall
  date: 2026-07-14
`,
    );
    await writeFile(
      join(records, "nav.yaml"),
      `- id: news
  title: News
  sidebar: true
  source:
    blog: true
`,
    );
  }

  it("splits an unscoped blog into tenant blogs and rewrites nav", async () => {
    await seedWillowLike();
    await migrateRemoveTenants(dataDir);
    const meta = JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8")) as { schemaVersion: number };
    expect(meta.schemaVersion).toBe(3);
    const fair = parseYaml(await readFile(join(dataDir, "records/content/fair.yaml"), "utf8")) as {
      parentId: string;
      fields?: Record<string, string>;
    };
    expect(fair.parentId).toBe("hall");
    expect(fair.fields?.tenant).toBeUndefined();
    const hall = parseYaml(await readFile(join(dataDir, "records/content/hall.yaml"), "utf8")) as { type: string };
    expect(hall.type).toBe("blog");
    const nav = parseYaml(await readFile(join(dataDir, "records/nav.yaml"), "utf8")) as { id: string }[];
    expect(nav[0]?.id).toBe("hall");
  });
});
