/** Demo runtime module — plain list (editable via editor Raw file). */
export default function mount(root, { dataset, host }) {
  const payload = dataset;
  const wrap = host.el("div", { className: "tessera-dataset-list-wrap" });
  const rows = payload?.rows ?? [];
  if (!rows.length) {
    const text = payload?.empty?.trim() ?? "";
    if (text) {
      const p = host.el("p", { className: "wh-muted" });
      const em = host.el("em");
      em.textContent = text;
      p.append(em);
      wrap.append(p);
    }
    root.replaceChildren(wrap);
    return;
  }
  const ul = host.el("ul", { className: "tessera-dataset-list" });
  for (const row of rows) {
    const li = host.el("li");
    const title =
      row.displayName?.trim() && row.displayName !== `#${row.uid}`
        ? row.displayName
        : Object.values(row.values ?? {}).find((v) => v?.trim()) ?? row.displayName ?? `#${row.uid}`;
    li.textContent = title;
    ul.append(li);
  }
  wrap.append(ul);
  root.replaceChildren(wrap);
}
