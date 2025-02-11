class WCBase extends HTMLElement {
    static a = {
        example: function (v) { console.log(`set example attribute to ${v}`) }
    }

    static get observedAttributes() { return Object.keys(this.a) }

    constructor() {
        super()
        this.attachShadow({ mode: 'open' })
        const childrenSlot = document.createElement('slot')
        this.shadowRoot.appendChild(childrenSlot)
        childrenSlot.addEventListener('slotchange', (e) => {
            if (this.childrenRehome) {
                childrenSlot.assignedNodes().forEach(n => this.childrenRehome.appendChild(n))
            }
        })
    }

    childrenRehome = null

    processElements(parent, children) {
        let newParent = null
        children.forEach(element => {
            if (Array.isArray(element)) {
                if (!newParent) throw 'Missing parent node when adding children'
                if (element.length == 0) {
                    // Empty array denotes the target for inherited children
                    this.childrenRehome = newParent
                } else {
                    this.processElements(newParent, element)
                }
            } else {
                newParent = parent.appendChild(element)
            }
        })
    }

    connectedCallback() {
        if (this.b) {
            this.processElements(this.shadowRoot, this.b())
        }
        if (this.c) {
            this.c()
        }
    }

    attributeChangedCallback(attr, vold, vnew) {
        this.constructor.a[attr].call(this, vnew)
    }

    d(props) {
        return this.e('div', props)
    }

    e(tag, props) {
        let el = document.createElement(tag)
        if (props) Object.assign(el, props)
        return el
    }
}

/*
class ABC extends WCBase {
    el_title = this.e('h3', { style: 'margin-top: 0;' })
    el_img = this.e('img', { style: 'float: right; margin: 0px 0px 20px 20px; width: 80px; height: auto;' })

    // declare that attributes that will be monitored for changes, and how the new value will be handled
    static a = {
        title: function (v) { this.el_title.innerText = v },
        src: function (v) { this.el_img.src = v },
    }

    // the build method should return an array of elements, with arrays of sub-elements, etc.
    b() {
        // Build up our element here. Cannot do this in constructor.
        this.el_img.src = this.el_img.src || 'http://acms.joyofhex.co.uk/no-image.png'

        this.style = 'position: relative; display: inline-block; width: 280px; margin: 20px; padding: 20px; border: solid 1px black; border-radius: 10px; box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.1); vertical-align: top;'

        return [
            this.el_title,
            this.el_img,
            this.d(),
            [],
        ]
    }

    // other code to run on the connectedCallback should go in here
    c() {
    }

    // use the d(props) and e(tag, props) convenience methods to build elements even more easily
}

customElements.define('wc-abc', ABC)

<wc-abc title="This is easy"><p>Hello</p><p>World</p></wc-abc>
*/
