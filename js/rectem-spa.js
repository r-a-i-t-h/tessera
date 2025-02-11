/*
    rectem-spa
    1.3.0

    Utilise rectem to render a website as a 'single-page-application'
    
    Dependency: rectem-core
    Optional dependency: w3css-helper - if available then will automatically hook in nav and headings_menu
*/

// global vars for gathering data
var rectem_data = rectem_data || [];
var rectem_media = rectem_media || [];
var nav_data = nav_data || [];
var site_data = site_data || {};

function RecTemSpa(spa_name = "rec-tem-spa", data_scripts = [], render_element_name = "rectem") {
    this.rectem = new RecTem();
    this.spa_name = spa_name;
    this.render_element_name = render_element_name;
    this.render_element = null; // will be referenced in init
    this.data_scripts = data_scripts;
    this.count_scripts_loaded = 0;
    this.count_scripts_success = 0;
    this.using_cached_data = false;
    this.init_hooks = [];
    this.post_rendering_hooks = [];
    this.post_processing_hooks = [];

    document.addEventListener("DOMContentLoaded", _ => this._begin_init(), false);

    this.add_init_hook = function (cb) {
        typeof (cb) === "function" && this.init_hooks.push(cb);
        return this;
    };

    this.add_post_processing_hook = function (cb) {
        typeof (cb) === "function" && this.post_processing_hooks.push(cb);
        return this;
    };

    this.add_post_rendering_hook = function (cb) {
        typeof (cb) === "function" && this.post_rendering_hooks.push(cb);
        return this;
    };

    this._script_loaded = function (is_success) {
        this.count_scripts_loaded++;
        this.count_scripts_success += is_success ? 1 : 0;
        if (this.count_scripts_loaded == this.data_scripts.length) {
            this._end_init();
        }
    };

    this._begin_init = function () {
        // automagically hook in w3css nav and headings_menu
        if (typeof (w3css) !== "undefined") {
            this.add_init_hook(w3css.insert_topbar_nav);
            this.add_init_hook(w3css.insert_sidebar_nav);
            this.add_post_rendering_hook(w3css.insert_headings_menu);
        }

        this.data_scripts.forEach(s => {
            let script_block = document.createElement("script");
            script_block.src = `${s}?${Math.random()}`;
            script_block.onload = _ => {
                this._script_loaded(true);
            };
            script_block.onerror = _ => {
                //console.log(`Unable to load data script ${script_block.src}`);
                this._script_loaded(false);
            };
            document.head.appendChild(script_block);
        });
    };

    this._end_init = function () {
        // if not all scripts loaded successfully, and if data is available in localStorage, then retrieve from localStorage
        if (this.count_scripts_loaded == this.count_scripts_success) {
            // store the data in localStorage
            if (typeof (window) != "undefined" && typeof (window.localStorage) != "undefined") {
                window.localStorage[this._localStorage_data_key()] = JSON.stringify(rectem_data);
                window.localStorage[this._localStorage_media_key()] = JSON.stringify(rectem_media);
                window.localStorage[this._localStorage_navdata_key()] = JSON.stringify(nav_data);
                window.localStorage[this._localStorage_sitedata_key()] = JSON.stringify(site_data);
            }
        } else {
            if (typeof (window.localStorage) != "undefined" && window.localStorage[this._localStorage_data_key()]) {
                rectem_data = JSON.parse(window.localStorage[this._localStorage_data_key()]);
                rectem_media = JSON.parse(window.localStorage[this._localStorage_media_key()]);
                nav_data = JSON.parse(window.localStorage[this._localStorage_navdata_key()]);
                site_data = JSON.parse(window.localStorage[this._localStorage_sitedata_key()]);
                this.using_cached_data = true;
            }
        } 

        // triggered when data loading complete
        this.rectem.addItems(rectem_data, rectem_media);
        this.render_element = document.getElementById(this.render_element_name) || document.body;
        window.addEventListener("hashchange", _ => this.render_page(), false);

        // trigger init hooks
        this.init_hooks.forEach(cb => cb());

        // render first page
        this.render_page();
    };

    this._localStorage_data_key = _ => `rectem-${this.spa_name}-data`;
    this._localStorage_media_key = _ => `rectem-${this.spa_name}-media`;
    this._localStorage_navdata_key = _ => `rectem-${this.spa_name}-navdata`;
    this._localStorage_sitedata_key = _ => `rectem-${this.spa_name}-sitedata`;
    
    this.render_page = function (id) {
        let rt = this.rectem;
        let pages;
        id =
            (id && (
                (typeof (id) === "string" && id)
                || (typeof (id) === "function" && id().toString())
            ))
            || (location.hash.substr(1))
            || (rt.item("home") && "home")
            || (rt.item("homepage") && "homepage")
            || ((pages = rt.itemsByTag("page")) && pages.length > 0 && pages[0].id);

        if (id && rt.item(id)) {
            // processing
            let rendering = rt.process(id);
            let htm = rt.render(rendering, "html");

            // trigger post-processing hooks
            this.post_processing_hooks.forEach(cb => htm = cb(htm));

            // apply
            this.render_element.innerHTML = "";
            window.scrollTo(0, 0);
            this.render_element.innerHTML = htm;

            // trigger post-rendering hooks
            this.post_rendering_hooks.forEach(cb => cb());
        }
    };
}
