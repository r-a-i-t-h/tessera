var rectem_data = (rectem_data || []).concat([
({
    id: "common-footer",
    tags: "",
    content: {
        footer: `
        <div class="w3-right w3-container w3-xlarge w3-text-white"><a href="#" onclick="window.scrollTo(0, 0); return false;"><i class="fa fa-chevron-circle-up"></i></a></div>
        &copy; 2020 :: @raith :: &lt;rec-tem&gt; &lt;w3-css&gt;
        `
    },
    parentId: "",
    relatedItems: [],
}),
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
}),
({
    id: "doodles",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: 'XXX'
    },
    parentId: "template-1",
    relatedItems: [],
}),
({
    id: "hex",
    tags: "page",
    content: {
        title: "{{func:auto_title joy of hex}}",
        main: `
        <style>
            #center {
                position: absolute;
                top: 50%;
                left: 50%;
                border: solid 1px black;
                width: 0px;
                height: 0px;
            }
            #hex1 {
                font-size: 30px;
                animation: wobble 3s infinite;
                animation-delay: 200ms;
            }
            #hex1, #hex1:before, #hex1:after {
                background-color: #ccc;
            }
            #hex2 {
                font-size: 20px;
                animation: wobble 3s infinite;
                animation-delay: 100ms;
            }
            #hex2, #hex2:before, #hex2:after {
                background-color: #999;
            }
            #hex3 {
                font-size: 10px;
                animation: wobble 3s infinite;
                animation-delay: 0ms;
            }
            #hex3, #hex3:before, #hex3:after {
                background-color: #666;
            }
            .hex {
                position: absolute;
                left: -0.5em;
                top: -0.87em;
                border-width: 0.1px;
                border-width: 0;
                border-style: solid none;
                width: 1em;
                height: 1.74em;
            }
            .hex:before {
                content: "";
                position: absolute;
                border: inherit;
                width: 100%;
                height: 100%;
                transform: rotate(-60deg);
            }
            .hex:after {
                content: "";
                position: absolute;
                border: inherit;
                width: 100%;
                height: 100%;
                transform: rotate(60deg);
            }
            @keyframes wobble {
                0% { transform: rotate(-90deg); transition: ease-in-out; }
                50% { transform: rotate(90deg); transition: ease-in-out; }
                100% { transform: rotate(-90deg); transition: ease-in-out; }
            }
        </style>
        <div class="w3-display-container w3-padding-64">
            <div class="w3-display-middle">
                <div id="hex1" class="hex"></div>
                <div id="hex2" class="hex"></div>
                <div id="hex3" class="hex"></div>
            </div>
        </div>
    `
    },
    parentId: "template-1",
    relatedItems: [],
}),
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
}),
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
}),
({
    id: "plexiform",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: `
            <p class="w3-large">Plexiform is an npm package which installs globally as a command line utility for scaffolding code from templates.</p>
            <p class="w3-code">
                npm install -g plexiform
            </p>
        `
    },
    parentId: "template-1",
    relatedItems: [],
}),
({
    id: "rectem",
    tags: "page",
    content: {
        title: "{{func:auto_title rec-tem}}",
        main: [`
            <p class="w3-large">Rec-tem stands for Recursive Templates and is a very lightweight library for dynamically rendering HTML from JSON data where the data items are both templates and content.</p>
            <p>The also-very-lightweight and really-rather-good W3-CSS Modern Responsive CSS Framework is the chosen rendering target, although any other framework could be used.</p>
            <p>This site is running from Rec-tem and W3-CSS.</p>
        `,
            w3css.quote("They can't both be best, so take the best of both."),
            w3css.cells([
                `<h3>TO DO</h3>
            <ul>
                <li>gallery
                <li>fanciness
            </ul>`,
                `<h3>DONE</h3>
            <ul>
                <li>cache-busting
                <li>iterators
                <li>dynamic menus
            </ul>`,
            ], ["w3-orange", "w3-teal"])
        ],
    },
    parentId: "template-1",
    relatedItems: [],
}),
({
    id: "tooling",
    tags: "page",
    content: {
        title: "{{func:auto_title}}",
        main: 'XXX'
    },
    parentId: "template-1",
    relatedItems: [],
}),
({
    id: "master",
    tags: "master",
    content: {
        html: `
        <div class="w3-content">{{zone:body}}</div>
        <footer id="myFooter">
        <div class= "w3-theme-l3 w3-padding-32 w3-center">
        {{zone:footer}}
        </div>
        </footer>
        `
    },
    parentId: "",
    relatedItems: [],
}),
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
}),
]);
