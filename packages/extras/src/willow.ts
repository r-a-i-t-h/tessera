import type { Page } from "@r-a-i-t-h/tessera-model";
import { hrefForPage, type ComponentFn } from "@r-a-i-t-h/tessera-renderer";

/** Scalar field named by a type. Missing and blank are the same. */
export function fieldValue(page: Page, id: string): string {
  const value = page.fields?.[id];
  return typeof value === "string" ? value.trim() : "";
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

function typeIds(props: Record<string, unknown>): string[] {
  const value = props.types ?? props.type;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function dateWindow(props: Record<string, unknown>): "past" | "upcoming" | "all" {
  const when = props.when;
  if (when === "past" || when === "upcoming") return when;
  if (props.upcoming === true) return "upcoming";
  return "all";
}

function str(props: Record<string, unknown>, key: string, fallback: string): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}

function num(props: Record<string, unknown>, key: string): number | undefined {
  return typeof props[key] === "number" ? (props[key] as number) : undefined;
}

/**
 * Dated entries of the named types. Reads the `date` and `precis` fields.
 * `when` is `past`, `upcoming`, or all. Extra fields stay off this list.
 * The page around the binding supplies the heading.
 */
export const datedList: ComponentFn = (ctx, props = {}) => {
  const wanted = typeIds(props);
  const limit = num(props, "limit");
  const empty = str(props, "empty", "Nothing listed yet.");
  const when = dateWindow(props);
  const today = new Date().toISOString().slice(0, 10);

  let rows = ctx.document.pages
    .filter((page) => wanted.includes(page.type ?? ""))
    .map((page) => ({ page, date: fieldValue(page, "date"), precis: fieldValue(page, "precis") }))
    .filter((row) => row.date);
  if (when === "upcoming") rows = rows.filter((row) => row.date >= today);
  if (when === "past") rows = rows.filter((row) => row.date < today);
  rows.sort((a, b) => (when === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  if (limit !== undefined) rows = rows.slice(0, limit);
  if (!rows.length) return `<p class="wh-muted"><em>${ctx.escapeHtml(empty)}</em></p>`;

  return `<div class="wh-card-list">${rows
    .map(({ page, date, precis }) => {
      const parts = dateParts(date);
      return `<article class="wh-card">
        <div class="wh-date-tile" aria-hidden="true"><span>${ctx.escapeHtml(parts.mon)}</span><strong>${ctx.escapeHtml(parts.day)}</strong></div>
        <div>
          <h3><a href="${hrefForPage(ctx, page.id)}">${ctx.escapeHtml(page.title)}</a></h3>
          <p class="wh-meta"><time datetime="${ctx.escapeHtml(date)}">${ctx.escapeHtml(formatDate(date))}</time></p>
          ${precis ? `<p>${ctx.escapeHtml(precis)}</p>` : ""}
        </div>
      </article>`;
    })
    .join("")}</div>`;
};

export const peopleGrid: ComponentFn = (ctx, props = {}) => {
  const limit = num(props, "limit");
  const wanted = typeIds(props);
  const types = wanted.length ? wanted : ["person"];
  let people = ctx.document.pages
    .filter((page) => types.includes(page.type ?? ""))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (limit !== undefined) people = people.slice(0, limit);
  if (!people.length) return `<p class="wh-muted"><em>No profiles yet.</em></p>`;

  return `<div class="w3-row-padding wh-people">${people
    .map((page) => {
      const photo = fieldValue(page, "photo");
      const role = fieldValue(page, "role");
      const img = photo ? ctx.mediaHtml(photo) : "";
      return `<div class="w3-col s12 m6 l4">
        <a class="wh-person-card" href="${hrefForPage(ctx, page.id)}">
          <div class="wh-person-photo">${img}</div>
          <h3>${ctx.escapeHtml(page.title)}</h3>
          ${role ? `<p>${ctx.escapeHtml(role)}</p>` : ""}
        </a>
      </div>`;
    })
    .join("")}</div>`;
};

export const articleByline: ComponentFn = (ctx) => {
  const date = fieldValue(ctx.page, "date");
  const chair = fieldValue(ctx.page, "chair");
  const bits = [
    date ? formatDate(date) : "",
    fieldValue(ctx.page, "time"),
    fieldValue(ctx.page, "where"),
    fieldValue(ctx.page, "author"),
    chair ? `Chair: ${chair}` : "",
    fieldValue(ctx.page, "week"),
  ].filter(Boolean);
  if (!bits.length) return "";
  const datetime = date ? ` datetime="${ctx.escapeHtml(date)}"` : "";
  return `<p class="wh-byline"><time${datetime}>${ctx.escapeHtml(bits.join(" · "))}</time></p>`;
};

export const profileKicker: ComponentFn = (ctx) => {
  const role = fieldValue(ctx.page, "role");
  if (!role) return "";
  return `<p class="wh-kicker">${ctx.escapeHtml(role)}</p>`;
};

export const profilePhoto: ComponentFn = (ctx) => {
  const photo = fieldValue(ctx.page, "photo");
  if (!photo) return "";
  return `<div class="wh-profile-photo">${ctx.mediaHtml(photo)}</div>`;
};

export const profileFacts: ComponentFn = (ctx) => {
  const email = fieldValue(ctx.page, "email");
  if (!email) return "";
  return `<p><a href="mailto:${ctx.escapeHtml(email)}">${ctx.escapeHtml(email)}</a></p>`;
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

