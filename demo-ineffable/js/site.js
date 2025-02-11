/*
    ineffable site functions
    0.0.0
*/

var auto_title = (ren, title) => title || ren.target.id;

var random_cells = (ren, args) => {
    let input_list = args ? JSON.parse(args) : [];
    return new Array(Math.ceil(Math.random() * 5)).join(".").split(".").map((s, i) => `<h3>${input_list[i] || ""}</h3><p>This is randomly generated cell content.</p>`);
};
