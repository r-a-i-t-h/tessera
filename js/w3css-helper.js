/*
    w3css-helper
    1.2.0
*/

// global vars for gathering data
var nav_data = nav_data || [];

var w3css = {

    row_layouts: {
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
    },

    section: function (content = "", classes = "", add_container = false) {
        return content
            ? `<div class="w3-section ${classes}">${add_container ? this.container(content) : content}</div>`
            : "";
    },

    container: function (content = "", classes = "") {
        return content
            ? `<div class="w3-container ${classes}">${content}</div>`
            : "";
    },

    div: function (content = "", classes = "") {
        return content
            ? `<div class="${classes}">${content}</div>`
            : "";
    },

    row_tight: function (cells_content = [], row_layout = null, cells_classes = []) {
        let htm = "";
        let layout = row_layout ? this.row_layouts[row_layout] : cells_content.map(_ => "");
        if (layout && layout.length > 0) {
            htm += '<div class="w3-row">';
            for (let i = 0; i < layout.length; i++) {
                htm += this.div(cells_content[i] || "", `${layout[i] || ""} ${cells_classes[i] || ""}`);
            }
            htm += '</div>';
        }
        return htm;
    },

    row_padding: function (cells_content = [], row_layout = null, cells_classes = []) {
        let htm = "";
        let layout = row_layout ? this.row_layouts[row_layout] : cells_content.map(_ => "");
        if (layout && layout.length > 0) {
            htm += '<div class="w3-row-padding w3-stretch">';
            for (let i = 0; i < layout.length; i++) {
                htm += this.div(cells_content[i] || "", `${layout[i] || ""} ${cells_classes[i] || ""}`);
            }
            htm += '</div>';
        }
        return htm;
    },

    cells: function (cells_content = [], cells_classes = []) {
        return cells_content && cells_content.length > 0
            ? `
                <div class="w3-section w3-cell-row">
                    ${cells_content.map((content, idx) => this.div(content, `w3-cell w3-container w3-mobile ${cells_classes[idx] || ""}`)).join("")}
                </div>
            `
            : "";
    },

    TABLE_DEFAULT_CLASSES: "w3-section w3-striped w3-border",
    TABLE_HEADER_DEFAULT_CLASSES: "w3-theme w3-wide",
    // TABLE_ROW_DEFAULT_CLASSES: "",
    // TABLE_CELL_DEFAULT_CLASSES: "",

    table: function (headers = [], rows_content = [], table_classes = null, header_classes = null, columns_classes = [], rows_classes = []) {
        return `
            <table class="w3-table ${table_classes != null ? table_classes : this.TABLE_DEFAULT_CLASSES}">
                ${headers.length > 0 ? `
                    <thead>
                        ${this.table_header_row(headers, header_classes, columns_classes)}
                    </thead>
                ` : ""}
                <tbody>
                    ${rows_content.map((row, idx) => this.table_row(row, rows_classes[idx], columns_classes)).join("")}
                </tbody>
            </table>
        `;
    },

    table_header_row: function (headers, header_classes, columns_classes) {
        return `
            <tr class="${header_classes != null ? header_classes : this.TABLE_HEADER_DEFAULT_CLASSES}">
                ${headers.map((h, idx) => `<th class="${columns_classes[idx] || ""}">${h}</th>`).join("")}
            </tr>
        `;
    },

    table_row: function (cells, row_classes, columns_classes) {
        return `
            <tr class="${row_classes || ""}">
                ${(cells || []).map((cell, idx) => this.table_cell(cell, columns_classes[idx])).join("")}
            </tr>
        `;
    },

    table_cell: function (cell, cell_classes) {
        return `
            <td class="${cell_classes || ""}">${cell}</td>
        `;
    },

    quote: function (content = "", colour_class = "w3-sand", max_width = "70%") {
        return content
            ? `
                <div class="w3-content w3-padding-16" style="max-width: ${max_width}">
                    <div class="w3-panel w3-card-4 w3-round-large ${colour_class}">
                        <p class="w3-left-align"><i class="fa fa-quote-left w3-xlarge w3-text-black w3-opacity-max"></i></p>
                        <p class=" w3-xlarge w3-serif w3-center">${content}</p>
                        <p class="w3-right-align"><i class="fa fa-quote-right w3-xlarge w3-text-black w3-opacity-max"></i></p>
                    </div>
                </div>
            `
            : "";
    },

    imgbox: function (img_url, caption, classes) {
        return img_url
            ? `
                <div class="w3-display-container w3-container w3-padding-16 w3-card w3-center ${classes}">
                    <img src="${img_url}" class="w3-image" style="width: 100%">
                    ${ caption ? `
                        <div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white w3-text-white">${caption}</div>
                        <div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-animate-opacity w3-text-black">${caption}</div>
                        ` : ""
            }
                </div>
            `
            : "";
    },

    img_text_link: function (img_url, caption, url, outer_classes, text_classes = "w3-xlarge", overlay_classes = "w3-black") {
        return img_url
            ? `
                <div class="w3-display-container w3-round-large w3-card-4 w3-center ${outer_classes || ""}" style="overflow: hidden; margin-bottom: 16px;">
                    <img src="${img_url}" class="w3-image" style="width: 100%;">
                    <div class="w3-display-middle animate-opacity-50 w3-display-hover ${overlay_classes}" style="width: 100%; height: 100%"></div>
                    ${ caption ? `
                        <div style="width: 80%" class="w3-display-middle w3-container w3-padding-16 w3-round-large w3-opacity-max w3-black w3-text-black ${text_classes}">${caption}</div>
                        <div style="width: 80%" class="w3-display-middle w3-container w3-padding-16 w3-text-white ${text_classes}">${caption}</div>
                        ` : ""
            }
                    ${url ? `<a href="${url}" style="position: absolute; display_block; top: 0px; left: 0px; width: 100%; height: 100%;"></a>` : ""}
                </div>
            `
            : "";
    },

    card: function (title, content, classes) {
        return title || content
            ? `
                <div class="w3-card w3-container ${classes}">
                    ${title ? `<h3>${title}</h3>` : ""}
                    ${content || ""}
                </div>
            `
            : "";
    },

    insert_headings_menu: function (target_element_name = "headings_menu", heading_level = "h2", scroll_offset = -50) {
        let menu_el = document.getElementById(target_element_name);
        if (menu_el) {
            let headings = Array.from(document.getElementsByTagName(heading_level));
            if (headings && headings.length > 0) {
                let ul_el = document.createElement("ul");
                ul_el.className = "w3-bar-block";

                headings.forEach((h2, idx) => {
                    let li = document.createElement("li");
                    let a = document.createElement("a");
                    a.innerHTML = h2.innerHTML;
                    a.href = "#";
                    a.className = "w3-bar-item w3-button w3-hover-light-grey";
                    a.addEventListener("click", (h2closure => ev => { h2closure.scrollIntoView(); window.scrollBy(0, scroll_offset); ev.preventDefault(); return false; })(h2));
                    li.appendChild(a);
                    ul_el.appendChild(li);
                });

                menu_el.appendChild(ul_el);
            }
        }
    },

    insert_topbar_nav: function () {
        if (typeof (nav_data) !== "undefined") {
            // Top bar
            let topbar_el = document.querySelector(".w3-top > .w3-bar");
            topbar_el && nav_data.forEach(nav => {
                if (nav && nav.topbar) {
                    let nav_el;
                    let show_opts = (nav.show && nav.show.toUpperCase()) || "*";
                    nav_el = document.createElement("a");
                    nav_el.href = `#${nav.id}`;
                    nav_el.innerHTML = `${nav.fa ? `<i class="fa fa-${nav.fa}"></i>${nav.title ? " " : ""}` : ""}${nav.title}`;
                    nav_el.className = `w3-bar-item w3-right w3-button w3-hover-black ${show_opts != "*" && show_opts.indexOf("D") == -1 ? "w3-hide-large" : ""} ${show_opts != "*" && show_opts.indexOf("T") == -1 ? "w3-hide-medium" : ""} ${show_opts != "*" && show_opts.indexOf("M") == -1 ? "w3-hide-small" : ""}`;
                    nav_el && topbar_el.appendChild(nav_el);
                }
            });
        }
    },

    insert_sidebar_nav: function () {
        if (typeof (nav_data) !== "undefined") {
            // Sidebar
            let sidebar_el = document.querySelector(".w3-sidebar > .nav_data") || document.querySelector(".w3-sidebar");
            sidebar_el && nav_data.forEach(nav => {
                if (nav && nav.sidebar) {
                    let nav_el;
                    if (nav.heading) {
                        nav_el = document.createElement("h4");
                        nav_el.innerHTML = `${nav.fa ? `<i class="fa fa-${nav.fa}"></i>${nav.heading ? " " : ""}` : ""}<strong>${nav.heading}</strong>`;
                        nav_el.className = "w3-bar-item";
                    } else {
                        nav_el = document.createElement("a");
                        nav_el.href = `#${nav.id}`;
                        nav_el.innerHTML = `${nav.fa ? `<i class="fa fa-${nav.fa}"></i>${nav.title ? " " : ""}` : ""}${nav.title}`;
                        nav_el.className = "w3-bar-item w3-button w3-hover-theme w3-round-large";
                        nav_el.addEventListener("click", ev => w3_close());
                    }
                    nav_el && sidebar_el.appendChild(nav_el);
                }
            });
        }
    },
};
