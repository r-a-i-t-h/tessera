var rectem_data = (rectem_data || []).concat([
    {
        id: "master",
        tags: "master",
        content: {
            html: `
            <div class="w3-content">{{zone:body}}</div>
            <footer id="myFooter">
                <div class= "w3-theme-l3 w3-padding-16 w3-center">
                    {{zone:footer}}
                </div>
            </footer>
            `
        },
        parentId: "",
        relatedItems: []
    },

    {
        id: "template-basic",
        tags: "template",
        content: {
            body: `
            <div class="w3-container">
                <h1 class="w3-text-theme">{{zone:PageTitle}}</h1>
                {{func:env.offline_mode Offline mode. Please go online and refresh the page for latest content.||<div style="background-color: #fee;color: #900; font-weight: bold; padding: 10px; text-align: center; margin-bottom: 10px; border-radius: 4px;">[[CONTENT]]</div>}}
                {{zone:MainContent}}
            </div>
            `
        },
        parentId: "master",
        relatedItems: ['common-footer']
    },

    {
        id: "common-footer",
        content: {
            footer: `
                <div class="w3-right w3-container w3-xlarge w3-text-white"><a href="#" onclick="window.scrollTo(0, 0); return false;"><i class="fa fa-chevron-circle-up"></i></a></div>
                <p>&copy; Miller's Ark</p><p class="w3-tiny">@raith :: &lt;rec-tem&gt; + &lt;w3-css&gt;</p>
            `
        }
    },

]);
