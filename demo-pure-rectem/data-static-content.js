var rectem_data = (rectem_data || []).concat([
	{
		id: "page1",
		tags: "page",
		content: { 
			title: 'Page 1', 
			content: '<p>Static content {{media:pic1 <div style="display: inline-block; border: solid 1px #ccc; box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.2); padding: 2px; border-radius: 10px;">[[CONTENT]]</div>}}</p>', 
			footer: 'This is ignored' 
		},
		parentId: "template1",
		relatedItems: []
	},

	{
		id: "page2",
		tags: "page",
		content: { 
			title: 'Page 2', 
			content: '<p>Dynamic {{zone:loremipsum}} content</p><p>{{func:dynamic_data.now color: red;}}</p><p>{{func:dynamic_data.now font-weight: bold;}}</p>', 
			footer: 'This is included {{zone:loremipsum}}'  
		},
		parentId: "template2",
		relatedItems: ['loremipsum','thing']
	},

	{
		id: "page3",
		tags: "page",
		content: { 
			title: 'About us', 
			content: '<p>Wow, I really think this might work!</p><p>{{zone:loremipsum}}</p>' 
		},
		parentId: "template1",
		relatedItems: ['loremipsum']
	},

	{
		id: "common_footer",
		tags: "",
		content: {
			title: "(why does this bit come first?)",
			footer: "<p>Common footer</p>"
		},
		parentId: "",
		relatedItems: []
	},

	{
		id: "thing",
		content: {
			content: my_thing
		}
	}
]);

var rectem_media = (rectem_media || []).concat([
	{
		id: "pic1",
		title: "This is a picture",
		url: "http://www.ineffable.co.uk/twig-logo-green.gif",
		type: "png"
	}
]);
