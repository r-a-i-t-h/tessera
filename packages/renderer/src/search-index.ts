import MiniSearch from "minisearch";
import {
  flattenPageTree,
  publishedPageTree,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";

export type SearchIndexDocument = {
  id: string;
  title: string;
  description: string;
  precis: string;
  tags: string;
  body: string;
  path: string;
  type: string;
  tagList: string[];
};

export type SearchIndexPayload = {
  version: 1;
  /** MiniSearch serialized index (includes stored fields). */
  index: object;
  /** Distinct tags / types for filter controls. */
  facets: { tags: string[]; types: string[] };
};

const FIELD_BOOSTS = {
  title: 8,
  tags: 4,
  description: 2,
  precis: 2,
  body: 1,
} as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "with",
]);

/** Strip tags and collapse whitespace for indexing. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function zonePlainText(page: SiteDocument["pages"][number]): string {
  const parts: string[] = [];
  for (const blocks of Object.values(page.zones ?? {})) {
    for (const block of blocks) {
      if (block.type === "text" && block.html) parts.push(stripHtmlToText(block.html));
      if (block.type === "image" && block.caption) parts.push(block.caption);
      if (block.type === "image" && block.alt) parts.push(block.alt);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function extractSearchDocuments(document: SiteDocument): SearchIndexDocument[] {
  const tree = publishedPageTree(document);
  const pages = flattenPageTree(tree);
  const pathById = new Map(pages.map((node) => [node.page.id, node.path]));

  return document.pages.map((page) => {
    const tags = page.tags ?? [];
    const precis = typeof page.fields?.precis === "string" ? page.fields.precis : "";
    return {
      id: page.id,
      title: page.title,
      description: page.description ?? "",
      precis,
      tags: tags.join(" "),
      body: zonePlainText(page),
      path: pathById.get(page.id) ?? page.id,
      type: page.type ?? "",
      tagList: [...tags],
    };
  });
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/** Build a MiniSearch instance ready to serialize or query. */
export function createSearchEngine(docs?: SearchIndexDocument[]): MiniSearch<SearchIndexDocument> {
  const mini = new MiniSearch<SearchIndexDocument>({
    fields: ["title", "tags", "description", "precis", "body"],
    storeFields: ["id", "title", "description", "precis", "path", "type", "tagList"],
    searchOptions: {
      boost: { ...FIELD_BOOSTS },
      prefix: true,
      fuzzy: false,
      combineWith: "AND",
    },
    tokenize,
    processTerm: (term) => (STOP_WORDS.has(term) ? null : term),
  });
  if (docs?.length) mini.addAll(docs);
  return mini;
}

export function buildSearchIndex(document: SiteDocument): MiniSearch<SearchIndexDocument> {
  return createSearchEngine(extractSearchDocuments(document));
}

export function searchIndexPayload(document: SiteDocument): SearchIndexPayload {
  const docs = extractSearchDocuments(document);
  const tags = new Set<string>();
  const types = new Set<string>();
  for (const doc of docs) {
    for (const tag of doc.tagList) tags.add(tag);
    if (doc.type) types.add(doc.type);
  }
  return {
    version: 1,
    index: createSearchEngine(docs).toJSON(),
    facets: {
      tags: [...tags].sort((a, b) => a.localeCompare(b)),
      types: [...types].sort((a, b) => a.localeCompare(b)),
    },
  };
}

export function searchIndexJson(document: SiteDocument): string {
  return `${JSON.stringify(searchIndexPayload(document))}\n`;
}

export function loadSearchEngine(payload: SearchIndexPayload): MiniSearch<SearchIndexDocument> {
  return MiniSearch.loadJSON<SearchIndexDocument>(JSON.stringify(payload.index), {
    fields: ["title", "tags", "description", "precis", "body"],
    storeFields: ["id", "title", "description", "precis", "path", "type", "tagList"],
    searchOptions: {
      boost: { ...FIELD_BOOSTS },
      prefix: true,
      fuzzy: false,
      combineWith: "AND",
    },
    tokenize,
    processTerm: (term) => (STOP_WORDS.has(term) ? null : term),
  });
}

export type SearchHit = {
  id: string;
  title: string;
  description: string;
  precis: string;
  path: string;
  type: string;
  tagList: string[];
  score: number;
};

export type SearchQueryOptions = {
  query: string;
  limit?: number;
  tag?: string;
  type?: string;
  sort?: "relevance" | "title";
};

/** Ranked search with optional post-filters and sort. */
export function runSearch(
  mini: MiniSearch<SearchIndexDocument>,
  options: SearchQueryOptions,
): SearchHit[] {
  const q = options.query.trim();
  if (!q) return [];

  const raw = mini.search(q, {
    boost: { ...FIELD_BOOSTS },
    prefix: true,
    fuzzy: false,
    combineWith: "AND",
  });

  let hits: SearchHit[] = raw.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    precis: String(row.precis ?? ""),
    path: String(row.path ?? ""),
    type: String(row.type ?? ""),
    tagList: Array.isArray(row.tagList) ? (row.tagList as string[]) : [],
    score: row.score,
  }));

  if (options.tag) {
    const tag = options.tag;
    hits = hits.filter((h) => h.tagList.includes(tag));
  }
  if (options.type) {
    const type = options.type;
    hits = hits.filter((h) => h.type === type);
  }

  if (options.sort === "title") {
    hits.sort((a, b) => {
      const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      if (byTitle !== 0) return byTitle;
      return a.id.localeCompare(b.id);
    });
  } else {
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.title.length !== b.title.length) return a.title.length - b.title.length;
      return a.id.localeCompare(b.id);
    });
  }

  if (options.limit !== undefined && options.limit >= 0) {
    return hits.slice(0, options.limit);
  }
  return hits;
}

export { FIELD_BOOSTS };
