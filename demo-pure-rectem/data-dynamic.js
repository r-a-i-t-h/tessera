
var dynamic_data = {

	now: (rendering_context, style) => (d => `<span style="${style};">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`)(new Date())
	,
	navmenu: rendering_context => rendering_context.rectem.itemsByTag("page").map(i => `<a href="#${i.id}" style="display: block; padding: 10px 20px; background-color: #eee; margin: 2px; text-align: center; color: #000; text-decoration: none;${rendering_context.target == i ? "font-weight: bold; background-color: #ddd;" : ""}">${i.content["title"]}</a>`).join("")

}

var my_thing = {
	name: "a thing, which is just an object with an overidden toString() method.",
	toString: function (ren) { return `Hi, I'm ${this.name}. And I'm appearing here because you asked for ${ren.target.id}` }
}
