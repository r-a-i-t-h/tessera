import type { Block, Page } from "@r-a-i-t-h/tessera-model";
import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";

export type PageMeta = {
  date?: string;
  time?: string;
  where?: string;
  author?: string;
  summary?: string;
  role?: string;
  email?: string;
  photo?: string;
  chair?: string;
  week?: string;
};

function asMeta(data: unknown): PageMeta {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const o = data as Record<string, unknown>;
  const pick = (k: keyof PageMeta) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  return {
    date: pick("date"),
    time: pick("time"),
    where: pick("where"),
    author: pick("author"),
    summary: pick("summary"),
    role: pick("role"),
    email: pick("email"),
    photo: pick("photo"),
    chair: pick("chair"),
    week: pick("week"),
  };
}

export function metaFromPage(page: Page): PageMeta {
  const blocks = (page.zones?.meta ?? []) as Block[];
  for (const b of blocks) {
    if (b.type === "json") return asMeta(b.data);
  }
  return {};
}

/** Date-only ISO strings stay on the intended calendar day in any TZ. */
export function formatDate(iso: string): string {
  const d = new Date(/T/.test(iso) ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dateParts(iso: string): { mon: string; day: string } {
  const d = new Date(/T/.test(iso) ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { mon: "", day: iso };
  return {
    mon: d.toLocaleDateString("en-GB", { month: "short" }),
    day: String(d.getDate()),
  };
}

function taggedPages(pages: Page[], tag: string): { page: Page; meta: PageMeta }[] {
  const newestFirst = tag !== "event";
  return pages
    .filter((p) => (p.tags ?? []).includes(tag))
    .map((page) => ({ page, meta: metaFromPage(page) }))
    .sort((a, b) => {
      const cmp = (a.meta.date ?? "").localeCompare(b.meta.date ?? "");
      return newestFirst ? -cmp : cmp;
    });
}

function str(props: Record<string, unknown>, key: string, fallback: string): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}

function num(props: Record<string, unknown>, key: string): number | undefined {
  return typeof props[key] === "number" ? (props[key] as number) : undefined;
}

/**
 * List-on-page view of dated pages (blog / events / meetings).
 * Reads `meta` JSON zones on tagged pages — not a layout-painted zone.
 */
export const datedList: ComponentFn = (ctx, props = {}) => {
  const tag = str(props, "tag", "blog");
  const variant =
    str(props, "variant", "") ||
    (tag === "event" ? "events" : tag === "meeting" ? "meetings" : "news");
  const limit = num(props, "limit");
  const empty = str(props, "empty", "Nothing listed yet.");
  const upcoming = props.upcoming === true;

  let rows = taggedPages(ctx.document.pages, tag);
  if (upcoming) {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter((row) => (row.meta.date ?? "") >= today);
  }
  if (limit !== undefined) rows = rows.slice(0, limit);
  if (!rows.length) return `<p class="wh-muted"><em>${ctx.escapeHtml(empty)}</em></p>`;

  if (variant === "events") {
    return `<div class="wh-event-list">${rows
      .map(({ page, meta }) => {
        const parts = meta.date ? dateParts(meta.date) : { mon: "", day: "" };
        const when = [meta.time, meta.where].filter(Boolean).join(" · ");
        return `<article class="wh-event-card">
          <div class="wh-date-tile" aria-hidden="true"><span>${ctx.escapeHtml(parts.mon)}</span><strong>${ctx.escapeHtml(parts.day)}</strong></div>
          <div>
            <h3><a href="#${page.id}">${ctx.escapeHtml(page.title)}</a></h3>
            ${when ? `<p class="wh-meta">${ctx.escapeHtml(when)}</p>` : ""}
            ${meta.summary ? `<p>${ctx.escapeHtml(meta.summary)}</p>` : ""}
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }

  return `<div class="wh-card-list">${rows
    .map(({ page, meta }) => {
      const bits = [
        meta.date ? formatDate(meta.date) : "",
        meta.author,
        meta.chair ? `Chair: ${meta.chair}` : "",
        meta.week,
      ].filter(Boolean);
      return `<article class="wh-card">
        ${bits.length ? `<p class="wh-meta">${ctx.escapeHtml(bits.join(" · "))}</p>` : ""}
        <h3><a href="#${page.id}">${ctx.escapeHtml(page.title)}</a></h3>
        ${meta.summary ? `<p>${ctx.escapeHtml(meta.summary)}</p>` : ""}
      </article>`;
    })
    .join("")}</div>`;
};

export const peopleGrid: ComponentFn = (ctx, props = {}) => {
  const limit = num(props, "limit");
  let people = ctx.document.pages
    .filter((p) => (p.tags ?? []).includes("person"))
    .map((page) => ({ page, meta: metaFromPage(page) }))
    .sort((a, b) => a.page.title.localeCompare(b.page.title));
  if (limit !== undefined) people = people.slice(0, limit);
  if (!people.length) return `<p class="wh-muted"><em>No profiles yet.</em></p>`;

  return `<div class="w3-row-padding wh-people">${people
    .map(({ page, meta }) => {
      const img = meta.photo ? ctx.mediaHtml(meta.photo) : "";
      return `<div class="w3-col s12 m6 l4">
        <a class="wh-person-card" href="#${page.id}">
          <div class="wh-person-photo">${img}</div>
          <h3>${ctx.escapeHtml(page.title)}</h3>
          ${meta.role ? `<p>${ctx.escapeHtml(meta.role)}</p>` : ""}
        </a>
      </div>`;
    })
    .join("")}</div>`;
};

export const articleByline: ComponentFn = (ctx) => {
  const meta = metaFromPage(ctx.page);
  const bits = [
    meta.date ? formatDate(meta.date) : "",
    meta.time,
    meta.where,
    meta.author,
    meta.chair ? `Chair: ${meta.chair}` : "",
    meta.week,
  ].filter(Boolean);
  if (!bits.length) return "";
  const datetime = meta.date ? ` datetime="${ctx.escapeHtml(meta.date)}"` : "";
  return `<p class="wh-byline"><time${datetime}>${ctx.escapeHtml(bits.join(" · "))}</time></p>`;
};

export const profileKicker: ComponentFn = (ctx) => {
  const role = metaFromPage(ctx.page).role;
  if (!role) return "";
  return `<p class="wh-kicker">${ctx.escapeHtml(role)}</p>`;
};

export const profilePhoto: ComponentFn = (ctx) => {
  const photo = metaFromPage(ctx.page).photo;
  if (!photo) return "";
  return `<div class="wh-profile-photo">${ctx.mediaHtml(photo)}</div>`;
};

export const profileFacts: ComponentFn = (ctx) => {
  const meta = metaFromPage(ctx.page);
  const email = meta.email
    ? `<p><a href="mailto:${ctx.escapeHtml(meta.email)}">${ctx.escapeHtml(meta.email)}</a></p>`
    : "";
  return email;
};

type AgendaRow = { item?: string; owner?: string };

export const agendaList: ComponentFn = (ctx, props = {}) => {
  const fromZone = str(props, "fromZone", "agenda");
  const rows = ctx.zoneJson<AgendaRow>(fromZone);
  if (!rows.length) return `<p class="wh-muted"><em>Agenda to follow.</em></p>`;
  return `<ol class="wh-agenda">${rows
    .map((row) => {
      const item = ctx.escapeHtml(row.item ?? "Untitled");
      const owner = row.owner
        ? ` <span class="wh-meta">${ctx.escapeHtml(row.owner)}</span>`
        : "";
      return `<li><span>${item}</span>${owner}</li>`;
    })
    .join("")}</ol>`;
};

type AttendeeRow = { name?: string; role?: string };

export const attendeeList: ComponentFn = (ctx, props = {}) => {
  const fromZone = str(props, "fromZone", "attendees");
  const rows = ctx.zoneJson<AttendeeRow>(fromZone);
  if (!rows.length) return "";
  return `<ul class="wh-attendees">${rows
    .map((row) => {
      const name = ctx.escapeHtml(row.name ?? "Guest");
      const role = row.role ? ` <span class="wh-meta">${ctx.escapeHtml(row.role)}</span>` : "";
      return `<li>${name}${role}</li>`;
    })
    .join("")}</ul>`;
};

