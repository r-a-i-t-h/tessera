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
