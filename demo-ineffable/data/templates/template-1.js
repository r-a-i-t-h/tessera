({
    id: "template-1",
    tags: "template",
    content: {
        body: `
        <div class="w3-container">
            <h1>{{zone:title}}</h1>
            {{func:env.offline_mode Offline mode. Please go online and refresh the page for latest content.||<div style="background-color: #fee;color: #900; font-weight: bold; padding: 10px; text-align: center; margin-bottom: 10px; border-radius: 4px;">[[CONTENT]]</div>}}
            {{zone:main [[CONTENT]]}}
        </div>
        `
    },
    parentId: "master",
    relatedItems: ['common-footer']
})