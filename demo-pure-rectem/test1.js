var rectem_data = (rectem_data || []).concat([
    {
        id: "master-tests",
        tags: "master",
        content: {
            html: `<!DOCTYPE html><html lang="en-gb">
                <head>
                    <title>{{zone:title}}</title>
                </head>
                <body>
                    <h1>{{zone:title}}</h1>
                    <div style="margin:20px; border: 1px dashed #900; padding: 20px; border-radius: 10px;">{{zone:part1}}</div>
                    <div style="margin:20px; border: 1px dashed #090; padding: 20px; border-radius: 10px;">{{zone:part2}}</div>
                    <div style="margin:20px; border: 1px dashed #009; padding: 20px; border-radius: 10px;">{{zone:part3}}</div>
                    {{zone:part4 <p style="margin:20px; border: 4px dashed #999; padding: 20px; border-radius: 10px;">[[CONTENT]]</p>}}
                </body>
            </html>`
        },
        parentId: "",
        relatedItems: []
    },

    {
        id: "test1",
        tags: "Various simple inter-zone refs",
        content: {
            title: "test1 title",
            part1: "{{zone:part3}} << 1 >>",
            part2: "{{zone:part3}} << 2 >> {{zone:part1}}",
            part3: "<< 3 >>",
        },
        parentId: "master-tests",
        relatedItems: []
    },

    {
        id: "test2",
        tags: "template",
        content: {
            title: "Dynamic content",
            part1: "<< 1 >>",
            part2: "{{func:test_rendering.make_boxout Box 1}}{{func:test_rendering.make_boxout Box 2}}{{func:test_rendering.make_boxout Box 3}}",
            part3: "{{func:test_rendering.random_boxouts 5}}",
        },
        parentId: "master-tests",
        relatedItems: []
    },

    {
        id: "test3",
        tags: "template",
        content: {
            title: "Circular reference between zones 1 and 3",
            part1: "<< 1 BEGIN >> {{zone:part3}} << 1 END >>",
            part2: "<< 2 BEGIN >> {{zone:part1}} << 2 END >>",
            part3: "<< 3 BEGIN >> {{zone:part1}} << 3 END >>",
            part4: () => `Random ${Math.random()}`,
        },
        parentId: "master-tests",
        relatedItems: []
    },

]);

var test_rendering = {

    make_boxout: (ren, c) => c ? `<div style="display: inline-block; border: solid 2px #009; margin: 10px; padding: 10px;">${c}</div>` : ""
    ,
    random_boxouts: (ren, c = 5) => (new Array(Math.ceil(Math.random() * c))).join(".").split(".").map((_, idx) => `Box ${idx + 1}`).map(item => test_rendering.make_boxout(null, item)).join("")
};
