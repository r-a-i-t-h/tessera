({
    id: "musings",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: [
            "<p class='w3-large'>These ideas are only half-baked, or maybe even more raw than that. But they are recorded here because I shall forget them otherwise. It's a sign of age.</p>",
            "<div class='w3-section' id='headings_menu'></div>",
            w3css.row_padding(
                [
                    "<h2>My half-baked idea 1</h2>{{zone:textbit}}",
                    w3css.imgbox("./img/img2.jpg", "pic 2"),
                ],
                "2l",
                ["", "w3-padding-16"]
            ),
            w3css.row_padding(
                [
                    w3css.imgbox("./img/img1.jpg", "pic 1"),
                    "<h2>My half-baked idea 2</h2>{{zone:textbit}}",
                ],
                "2r",
                ["w3-padding-16"]
            ),
            w3css.row_padding(
                [
                    "<h2>My half-baked idea 3</h2>{{zone:textbit}}",
                    w3css.imgbox("./img/img2.jpg", "pic 2"),
                ],
                "2l",
                ["", "w3-padding-16"]
            ),
            w3css.quote("if you believe you can, or if you believe you can't, you're right"),
        ],
        textbit: "<p>This would be some kind of explanation of some kind of idea, with a picture to accompany it. I'd like to come up with a more dynamic iterator for these itesms. Does iterated content need to contain zones? That's a key question. At the moment, the inner content is rendered up-front so that the zones can be parsed. I definitely want to be able to render the content later. So the question is really... do I want to parse zones from dynamically rendered content? Would need more robust reference and dependency management - it's easy at the moment as I only have to add and not remove.<p>"
    },
    parentId: "template-1",
    relatedItems: [],
})