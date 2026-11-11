/** Demo — meetings plus people from one walked payload (refs pull in other datasets). */
import { recordsByDataset, refUids, uidMap } from "./dataset-walk-helpers.js";

/** @param {HTMLElement} root @param {{ dataset?: { datasetId?: string; records?: Record<string, unknown> }; host: { el: Function; ui: { text: Function } } }} ctx */
export default function mount(root, ctx) {
  const { host, dataset } = ctx;
  const records = dataset?.records ?? {};
  const byDs = recordsByDataset(records);
  const meetingRows = byDs.meetings ?? [];
  const people = uidMap(records, "people");

  const wrap = host.el("div", { className: "tessera-meetings-roster" });

  const datasetIds = Object.keys(byDs).sort();
  const intro = host.ui.text({
    level: 3,
    heading: "Walked datasets in this binding",
    text: [
      `Primary dataset on the binding: “${dataset?.datasetId ?? "meetings"}”.`,
      `Tessera does not pass multiple dataset ids separately — it walks ref fields from the roots and packs every reached row into ctx.dataset.records as “datasetId:uid” keys.`,
      `This mount received: ${datasetIds.length ? datasetIds.join(", ") : "(none)"}.`,
    ].join(" "),
  });
  wrap.append(intro);

  if (!meetingRows.length) {
    const p = host.el("p", { className: "w3-text-grey" });
    p.textContent = "No meeting rows in the payload. Bind with dataset “meetings” (global, not page data).";
    wrap.append(p);
    root.replaceChildren(wrap);
    return;
  }

  const table = host.el("table", { className: "w3-table w3-bordered w3-small tessera-dataset-table" });
  const thead = host.el("thead");
  const headRow = host.el("tr");
  for (const label of ["Meeting", "When", "Chair", "Attendees"]) {
    const th = host.el("th");
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = host.el("tbody");
  for (const meeting of meetingRows.sort((a, b) => String(a.heldOn).localeCompare(String(b.heldOn)))) {
    const tr = host.el("tr");
    const titleCell = host.el("td");
    titleCell.textContent = String(meeting.title ?? "");
    tr.append(titleCell);

    const whenCell = host.el("td");
    whenCell.textContent = String(meeting.heldOn ?? "");
    tr.append(whenCell);

    const chairCell = host.el("td");
    const chairUid = refUids(meeting.chair)[0];
    const chair = chairUid ? people.get(chairUid) : undefined;
    chairCell.textContent = chair ? String(chair.name ?? chairUid) : chairUid ? `#${chairUid}` : "—";
    tr.append(chairCell);

    const attCell = host.el("td");
    const names = refUids(meeting.attendees).map((uid) => {
      const row = people.get(uid);
      return row ? String(row.name ?? uid) : `#${uid}`;
    });
    attCell.textContent = names.length ? names.join(", ") : "—";
    tr.append(attCell);

    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);

  const products = byDs.products?.length ?? 0;
  if (products > 0) {
    const aside = host.el("p", { className: "w3-small w3-text-grey" });
    aside.textContent = `Note: ${products} product row(s) are also present in the walked map — refs from meetings only pull in people, not products.`;
    wrap.append(aside);
  }

  root.replaceChildren(wrap);
}
