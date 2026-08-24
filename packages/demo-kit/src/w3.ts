/** Port of the classic w3css-helper layout helpers (string HTML). */

const rowLayouts: Record<string, string[]> = {
  "1": ["w3-full"],
  "2": ["w3-half", "w3-half"],
  "3": ["w3-third", "w3-third", "w3-third"],
  "4": ["w3-quarter", "w3-quarter", "w3-quarter", "w3-quarter"],
  "2l": ["w3-twothird", "w3-third"],
  "2r": ["w3-third", "w3-twothird"],
  "2lq": ["w3-threequarter", "w3-quarter"],
  "2rq": ["w3-quarter", "w3-threequarter"],
  "3l": ["w3-half", "w3-quarter", "w3-quarter"],
  "3m": ["w3-quarter", "w3-half", "w3-quarter"],
  "3r": ["w3-quarter", "w3-quarter", "w3-half"],
};

function div(content = "", classes = ""): string {
  return content ? `<div class="${classes}">${content}</div>` : "";
}

export const w3 = {
  rowLayouts,

  div,

  rowPadding(cells: string[] = [], layoutKey: string | null = null, cellClasses: string[] = []): string {
    const layout = layoutKey ? rowLayouts[layoutKey] : cells.map(() => "");
    if (!layout?.length) return "";
    let htm = '<div class="w3-row-padding w3-stretch">';
    for (let i = 0; i < layout.length; i++) {
      htm += div(cells[i] || "", `${layout[i] || ""} ${cellClasses[i] || ""}`);
    }
    return htm + "</div>";
  },

  cells(cells: string[] = [], cellClasses: string[] = []): string {
    if (!cells.length) return "";
    return `
      <div class="w3-section w3-cell-row">
        ${cells.map((c, i) => div(c, `w3-cell w3-container w3-mobile ${cellClasses[i] || ""}`)).join("")}
      </div>`;
  },

  quote(content = "", colourClass = "w3-sand", maxWidth = "70%"): string {
    if (!content) return "";
    return `
      <div class="w3-content w3-padding-16" style="max-width: ${maxWidth}">
        <div class="w3-panel w3-card-4 w3-round-large ${colourClass}">
          <p class="w3-left-align"><i class="fa fa-quote-left w3-xlarge w3-text-black w3-opacity-max"></i></p>
          <p class="w3-xlarge w3-serif w3-center">${content}</p>
          <p class="w3-right-align"><i class="fa fa-quote-right w3-xlarge w3-text-black w3-opacity-max"></i></p>
        </div>
      </div>`;
  },

  imgbox(imgUrl: string, caption = "", classes = ""): string {
    if (!imgUrl) return "";
    return `
      <div class="w3-display-container w3-container w3-padding-16 w3-card w3-center ${classes}">
        <img src="${imgUrl}" class="w3-image" style="width: 100%" alt="">
        ${
          caption
            ? `<div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white">${caption}</div>`
            : ""
        }
      </div>`;
  },

  imgTextLink(
    imgUrl: string,
    caption: string,
    url: string,
    outerClasses = "",
    textClasses = "w3-xlarge",
  ): string {
    if (!imgUrl) return "";
    return `
      <div class="w3-display-container w3-round-large w3-card-4 w3-center ${outerClasses}" style="overflow: hidden; margin-bottom: 16px;">
        <img src="${imgUrl}" class="w3-image" style="width: 100%;" alt="">
        <div class="w3-display-middle animate-opacity-50 w3-display-hover w3-black" style="width: 100%; height: 100%"></div>
        ${
          caption
            ? `<div style="width: 80%" class="w3-display-middle w3-container w3-padding-16 w3-round-large w3-opacity-max w3-black ${textClasses}">${caption}</div>
               <div style="width: 80%" class="w3-display-middle w3-container w3-padding-16 w3-text-white ${textClasses}">${caption}</div>`
            : ""
        }
        ${url ? `<a href="${url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" aria-label="${caption}"></a>` : ""}
      </div>`;
  },

  table(
    headers: string[] = [],
    rows: string[][] = [],
    tableClasses: string | null = null,
    headerClasses: string | null = null,
    _colClasses: string[] = [],
    rowClasses: string[] = [],
  ): string {
    const tClass = tableClasses ?? "w3-section w3-striped w3-border";
    const hClass = headerClasses ?? "w3-theme w3-wide";
    return `
      <table class="w3-table ${tClass}">
        ${
          headers.length
            ? `<thead><tr class="${hClass}">${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`
            : ""
        }
        <tbody>
          ${rows
            .map(
              (row, i) =>
                `<tr class="${rowClasses[i] || ""}">${row.map((c) => `<td>${c}</td>`).join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  },
};
