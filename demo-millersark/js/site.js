/*
    Millers Ark site functions
    1.0.0
*/

var auto_title = (ren, title) => title || ren.target.id;

function open_days_table(ren, options) {
    options = options || "";
    let today = date_help.today(), include_past = options.indexOf("past") > -1, include_future = options.indexOf("future") > -1;
    let open_days = site_data.open_days
        .filter(od => new Date(od.date) >= today ? include_future : include_past)
        .map(od => Object.assign({}, od, { date: date_help.parse(od.date) }));
    let rows_data = open_days
        .map(od => [date_help.display(od.date), od.type])
    let rows_classes = open_days
        .map(od => open_day_row_class(od, today));
    return rows_data.length == 0 ? "" : w3css.table(["Date", "Event"], rows_data, null, null, [], rows_classes);
}

function open_day_row_class(od, as_at_date) {
    as_at_date = as_at_date || date_help.today();
    if (od.date < as_at_date) return "w3-text-light-grey";
    let compare = od.type.toUpperCase();
    if (compare.indexOf("ADULTS ONLY") > -1) return "w3-black";
    if (compare.indexOf("RED LETTER") > -1) return "w3-red";
    if (compare.indexOf("FARMER FOR") > -1) return "w3-green";
    return "";
}
