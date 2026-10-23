/** Demo runtime module — plain list (editable via editor Raw file). */
export default function mount(host, { dataset, host: h }) {
  const payload = dataset;
  const wrap = h.el("div", { className: "tessera-dataset-list-wrap" });
  const rows = payload?.rows ?? [];
  if (!rows.length) {
    const text = payload?.empty?.trim() ?? "";
    if (text) {
      const p = h.el("p", { className: "wh-muted" });
      const em = h.el("em");
      em.textContent = text;
      p.append(em);
      wrap.append(p);
    }
    host.replaceChildren(wrap);
    return;
  }
  const ul = h.el("ul", { className: "tessera-dataset-list" });
  for (const row of rows) {
    const li = h.el("li");
    const title =
      row.displayName?.trim() && row.displayName !== `#${row.uid}`
        ? row.displayName
        : Object.values(row.values ?? {}).find((v) => v?.trim()) ?? row.displayName ?? `#${row.uid}`;
    li.textContent = title;
    ul.append(li);
  }
  wrap.append(ul);
  host.replaceChildren(wrap);
}
