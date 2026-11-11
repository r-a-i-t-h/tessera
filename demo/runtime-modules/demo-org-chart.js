/** Demo — org chart from walked <code>people</code> records (manager refs). */
import { uidMap } from "./dataset-walk-helpers.js";

const CHART_STYLE = `
.tessera-org-chart { overflow-x: auto; padding: 0.5rem 0; }
.tessera-org-chart ul {
  list-style: none;
  margin: 0;
  padding-left: 1.25rem;
  border-left: 2px solid #c8c8c8;
}
.tessera-org-chart > ul { padding-left: 0; border-left: none; }
.tessera-org-chart li { margin: 0.5rem 0; position: relative; }
.tessera-org-node {
  display: inline-block;
  padding: 0.35rem 0.65rem;
  border: 1px solid #bbb;
  border-radius: 4px;
  background: #f8f8f8;
}
.tessera-org-node strong { font-weight: 600; }
.tessera-org-role { color: #555; font-size: 0.92em; }
`;

/** @param {HTMLElement} root @param {{ dataset?: { datasetId?: string; records?: Record<string, unknown> }; host: { el: Function } }} ctx */
export default function mount(root, ctx) {
  const { host, dataset } = ctx;
  const people = [...uidMap(dataset?.records, "people").values()];
  const wrap = host.el("div", { className: "tessera-org-chart-wrap" });

  if (!people.length) {
    const note = host.el("p", { className: "w3-text-grey" });
    note.textContent =
      "No people records in the binding payload. Use a dataset list binding with dataset “people” and presentation “runtime module”.";
    wrap.append(note);
    root.replaceChildren(wrap);
    return;
  }

  if (!root.querySelector("style[data-tessera-org-chart]")) {
    const style = host.el("style", { "data-tessera-org-chart": "true" });
    style.textContent = CHART_STYLE;
    wrap.append(style);
  }

  const byUid = new Map(people.map((p) => [p.uid, p]));
  const roots = people.filter((p) => {
    const manager = p.manager;
    return !(typeof manager === "number" && byUid.has(manager));
  });

  const chart = host.el("div", { className: "tessera-org-chart" });
  const intro = host.el("p", { className: "w3-small w3-text-grey" });
  intro.textContent = `Built from ${people.length} walked record(s) in dataset “${dataset?.datasetId ?? "people"}”. Manager links become the tree.`;
  wrap.append(intro);
  chart.append(renderSubtree(host, roots, byUid));
  wrap.append(chart);
  root.replaceChildren(wrap);
}

/** @param {{ el: Function }} host @param {Record<string, unknown>[]} nodes @param {Map<number, Record<string, unknown>>} byUid */
function renderSubtree(host, nodes, byUid) {
  const ul = host.el("ul");
  for (const person of nodes) {
    const li = host.el("li");
    const uid = person.uid;
    const node = host.el("div", { className: "tessera-org-node" });
    const name = host.el("strong");
    name.textContent = String(person.name ?? `#${uid}`);
    node.append(name);
    const role = person.role;
    if (role) {
      const span = host.el("span", { className: "tessera-org-role" });
      span.textContent = ` — ${role}`;
      node.append(span);
    }
    li.append(node);

    const children = [...byUid.values()].filter((p) => p.manager === uid);
    if (children.length) li.append(renderSubtree(host, children, byUid));
    ul.append(li);
  }
  return ul;
}
