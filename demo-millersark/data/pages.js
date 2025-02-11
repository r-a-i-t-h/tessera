var rectem_data = (rectem_data || []).concat(
    [
        {
            "id": "home",
            "tags": "page",
            "parentId": "template-basic",
            "relatedItems": [],
            "content": {
                "PageTitle": "Miller's Ark Animals",

                "MainContent": [
                    `<p class="w3-large">Welcome to Miller's Ark Animals, the hands-on farm for ALL ages. TripAdvisor rated 4.5<i class='w3-text-yellow fa fa-star'></i></p>
                    <p class="justify">Visit us on the farm, or invite our mobile farm to your event. Cuddle up to all the animals and chat with our experienced staff. Treat your loved ones to a unique gift experience. Bringing the farm to you since 1991.`,
                    w3css.row_padding([
                        w3css.img_text_link("./img/img1.jpg", "Open Days", "#2131b262-462d-4e28-9bd2-2737091a3bf7", "height-8"),
                        w3css.img_text_link("./img/img2.jpg", "Gift Ideas", "#4ffb5d8b-c79b-464e-8623-728894b316a4", "height-8"),
                        w3css.img_text_link("./img/img1.jpg", "Animal Touch", "#895d9603-5c76-42c3-8cce-c520635d80c8", "height-8"),
                    ], "2", []),
                    w3css.row_padding([
                        w3css.img_text_link("./img/img2.jpg", "Open Days", "#2131b262-462d-4e28-9bd2-2737091a3bf7", "height-8"),
                        w3css.img_text_link("./img/img1.jpg", "Gift Ideas", "#4ffb5d8b-c79b-464e-8623-728894b316a4", "height-8"),
                        w3css.img_text_link("./img/img2.jpg", "Animal Touch", "#895d9603-5c76-42c3-8cce-c520635d80c8", "height-8"),
                    ], "3", []),
                    `{{func:open_days_table future||[[NONE]]<p class="w3-center">No open day dates available. Please check back later</p>||<p class="w3-center">Upcoming open days:</p>[[CONTENT]]}}`,
                ],
            }
        }
    ]
);