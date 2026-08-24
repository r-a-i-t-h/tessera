import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import { w3 } from "@r-a-i-t-h/tessera-demo-kit";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function today(): Date {
  return new Date(new Date().toDateString());
}

function display(d: Date): string {
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function rowClass(type: string, date: Date, asAt: Date): string {
  if (date < asAt) return "w3-text-light-grey";
  const compare = type.toUpperCase();
  if (compare.includes("ADULTS ONLY")) return "w3-black";
  if (compare.includes("RED LETTER")) return "w3-red";
  if (compare.includes("FARMER FOR")) return "w3-green";
  return "";
}

/** Port of the classic open_days_table site function. */
export const openDaysTable: ComponentFn = (ctx, props = {}) => {
  const when = typeof props.when === "string" ? props.when : "future";
  const includeFuture = when.includes("future");
  const includePast = when.includes("past");
  const asAt = today();

  const raw = (ctx.document.site.settings?.openDays as { date: string; type: string }[] | undefined) ?? [];
  const openDays = raw
    .map((od) => ({ ...od, dateObj: new Date(od.date) }))
    .filter((od) => (od.dateObj >= asAt ? includeFuture : includePast));

  if (!openDays.length) {
    return `<p class="w3-center">No open day dates available. Please check back later</p>`;
  }

  const rows = openDays.map((od) => [display(od.dateObj), od.type]);
  const classes = openDays.map((od) => rowClass(od.type, od.dateObj, asAt));
  return `<p class="w3-center">Upcoming open days:</p>${w3.table(["Date", "Event"], rows, null, null, [], classes)}`;
};
