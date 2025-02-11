({
    id: "ineffable",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: [
            "<p class='w3-dark-grey w3-padding-small'>TOP OF PAGE</p>",
            w3css.row_padding(
                [
                    "{{zone:main_wide}}",
                    "{{zone:main_narrow}}"
                ],
                "2l",
                ["", "w3-padding-16"]
            ),
            w3css.quote("good things come to those who code"),
            w3css.cells([
                "<h3>{{zone:cell1title}}</h3>{{zone:cell1content}}",
                "<h3>{{zone:cell2title}}</h3>{{zone:cell2content}}",
                "<h3>{{zone:cell3title}}</h3>{{zone:cell3content}}",
            ], ["w3-teal", "w3-orange", "w3-light-blue"]),
            "<p class='w3-dark-grey w3-padding-small'>BOTTOM OF PAGE</p>",
        ],
        cell1title: "OMG",
        cell1content: "<p>This is shaping up extremely well.</p><p>This might actually be a viable solution for a statically edited, dynamically rendered site.</p>",
        cell2title: "TO DO",
        cell2content: "<a href='#rectem'>see rec-tem page</a>",
        cell3title: "EDITOR",
        cell3content: "<p>This is a departure from the PurplceCms edit-in-place approach, so it will need a new editor.</p><p>I am thinking of a single AWS-hosted editor for all sites, with the data crunched down to static files.</p>",
        main_wide: "<h2>Welcome to the first rec-tem website</h2><p>This is also my first responsive website. I was going to be good and build it myself, but W3CSS is so good that it was daft not to make use of it.</p><p>Next is to convert Millers Ark and see if I can make it look attractive.</p>",
        main_narrow: w3css.imgbox("./img/img1.jpg", "This is not my picture."),
    },
    parentId: "template-1",
    relatedItems: [],
})