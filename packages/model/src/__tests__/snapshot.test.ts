import { describe, expect, it } from "vitest";
import {
  hashFromSiteUrl,
  hashSnapshotBody,
  parseSiteRevision,
  siblingDataUrl,
  snapshotFileName,
  stampSitePointer,
} from "../snapshot.js";

describe("snapshot file names", () => {
  it("hashes the exact file bytes and names the payload from that hash", async () => {
    const body = '{"version":1}\n';
    const hash = await hashSnapshotBody(body);
    expect(hash).toMatch(/^[a-f0-9]{20}$/);
    expect(await hashSnapshotBody(body)).toBe(hash);
    expect(await hashSnapshotBody(`${body} `)).not.toBe(hash);
    expect(snapshotFileName(hash)).toBe(`site.${hash}.json`);
  });

  it("parses a revision only when the file name matches the hash", () => {
    expect(parseSiteRevision({ hash: "abc123", file: "site.abc123.json" })).toEqual({
      hash: "abc123",
      file: "site.abc123.json",
    });
    expect(parseSiteRevision({ hash: "abc123", file: "site.json" })).toBeNull();
    expect(parseSiteRevision(null)).toBeNull();
  });

  it("reads the hash from a hashed URL and builds a sibling rev URL", () => {
    expect(hashFromSiteUrl("./data/site.abc123.json")).toBe("abc123");
    expect(hashFromSiteUrl("./data/site.json")).toBeNull();
    expect(siblingDataUrl("./data/site.abc123.json", "rev.json")).toBe("./data/rev.json");
    expect(siblingDataUrl("https://raith.com/willow/data/site.abc.json?t=1", "rev.json")).toBe(
      "https://raith.com/willow/data/rev.json",
    );
  });

  it("stamps and replaces the site pointer in index.html", () => {
    const stamped = stampSitePointer("<head>\n    <meta charset=\"UTF-8\" />\n  </head>", "./data/site.abc.json");
    expect(stamped).toContain('<meta name="tessera-site" content="./data/site.abc.json" />');
    const replaced = stampSitePointer(stamped, "./data/site.def.json");
    expect(replaced).toContain('content="./data/site.def.json"');
    expect(replaced).not.toContain("site.abc.json");
  });
});