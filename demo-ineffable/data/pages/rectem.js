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
})