var rectem_data = (rectem_data || []).concat([
	{
		id: "master",
		tags: "master",
		content: { 
				html: '{{zone:body}}'
		},
		parentId: "",
		relatedItems: []
	},

	{
		id: "template1",
		tags: "template",
		content: { 
			body: `
				{{zone:navmenu <div style="float:right;border:solid 1px black;padding: 0px; width: 20%; border-radius: 4px; overflow: hidden;">[[CONTENT]]</div>}}
				{{zone:title <h1>[[CONTENT]]</h1>}}{{zone:content}}
			`
		},
		parentId: "master",
		relatedItems: ['navmenu']
	},

	{
		id: "template2",
		tags: "template",
		content: { 
			body: '<h2>{{zone:title}}</h2>{{func:dynamic_data.navmenu}}{{zone:content}}<hr />{{zone:footer}}</h2>' 
		},
		parentId: "master",
		relatedItems: ['common_footer', 'copyright']
	},

	{
		id: "navmenu",
		tags: "widget",
		content: { 
			navmenu: '{{func:dynamic_data.navmenu}}' 
		},
		parentId: "",
		relatedItems: []
	},

	{
		id: "loremipsum",
		tags: "widget",
		content: { 
			loremipsum: 'Lorem Ipsum Dolore Dulce Gamma Whativo' 
		},
		parentId: "",
		relatedItems: []
	}
	
]);
