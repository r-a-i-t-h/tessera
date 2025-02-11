({
    id: "aws",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: `
        {{func:random_cells ["Route53","CloudFront","DynamoDB","Lambda","ECS","SQS","SNS"]||<div class="w3-cell w3-container w3-mobile w3-teal w3-border w3-border-white">[[ITEM]]</div>||<div class="w3-section w3-cell-row">[[CONTENT]]</div>}}`,
    },
    parentId: "template-1",
    relatedItems: [],
})