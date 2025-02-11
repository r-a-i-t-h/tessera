/*
	rectem-core
	1.2.0

	RecTem = Recursive Templates :)
*/

var RecTem = function () {
	"use strict";
	var rectem = this;

	this.logEnabled = false;

	// Items and Media
	this.items = {};
	this.tags = {};
	this.medias = {};

	this.addItem = function (id, tags, content, parentId, relatedItems) {
		// use supplied object or create a new one from parameters
		var obj = typeof (id) === "object" ? id : {
			id,
			tags,
			content,
			parentId,
			relatedItems
		};
		// define all properties
		obj.id = obj.id || "unknown";
		obj.tags = obj.tags || "";
		obj.content = obj.content || {};
		obj.parentId = obj.parentId || "";
		obj.relatedItems = obj.relatedItems || [];
		// parse the content
		for (var z in obj.content) {
			let content_item = obj.content[z];
			if (Array.isArray(content_item)) content_item = content_item.reduce((a, b) => a + b.toString(), "");
			if (typeof (content_item) == "string") {
				obj.content[z] = this.parseContent(content_item);
			}
		}
		// track this object
		this.items[obj.id] = obj;
		var tag, tagsArray = obj.tags.split(",");
		for (var t = 0; t < tagsArray.length; t++) {
			tag = tagsArray[t];
			if (tag) {
				this.tags[tag] = this.tags[tag] || [];
				this.tags[tag].push(obj);
			}
		}
		return obj;
	};

	this.addMedia = function (id, title, url, type) {
		var obj = typeof (id) === "object" ? id : {
			id,
			title,
			url,
			type
		};
		this.medias[obj.id] = obj;
		return obj;
	};

	this.addItems = function (items, medias) {
		if (items) items.forEach(i => this.addItem(i));
		if (medias) medias.forEach(m => this.addMedia(m));
	};

	this.item = function (id) {
		return this.items[id];
	};

	this.itemsByTag = function (tag) {
		return this.tags[tag] || [];
	};

	this.media = function (id) {
		return this.medias[id];
	};

	// Object constructor functions
	this.Ref = function (type, id, contextual_data = "") {
		this.type = type.toLowerCase(); // "zone", "func"
		this.id = id;
		this.func_args = null;
		this.outer_template = null;
		this.inner_template = null;
		// split the contextual data
		let ref_items = contextual_data.split("||");
		ref_items.forEach(item => {
			if (item.indexOf("[[CONTENT]]") > -1) {
				this.outer_template = item;
			} else if (item.indexOf("[[ITEM]]") > -1) {
				this.inner_template = item;
			} else if (item.indexOf("[[NONE]]") > -1) {
				this.none_replacement = item.replace("[[NONE]]", "");
			} else {
				this.func_args = item;
			}
		});
	};

	this.RenderZone = function (id) {
		this.id = id;
		this.consumers = []; // items which include this zone in their content
		this.providers = []; // items which contribute to the content of this zone
		this.creator = null; // the first provider added is also known as the creator
		this.content = [];
		this.html = "";
	};

	this.Rendering = function (rt) {
		// ref rectem
		this.rectem = rt;
		this.target = null;
		this.items = {};
		this.zones = {};
		this.root = null;

		this.item = function (id) {
			return this.items[id];
		};
		this.zone = function (id) {
			// note: retrieves or creates a zone
			var zone = this.zones[id];
			if (!zone) {
				zone = new rectem.RenderZone(id);
				this.zones[id] = zone;
			}
			return zone;
		};
		this.addItem = function (item) {
			this.target = this.target || item;
			this.items[item.id] = item;
		};
		this.registerZoneConsumer = function (zoneId, item) {
			var zone = this.zone(zoneId);
			if (!zone.consumers.includes(item)) zone.consumers.push(item);
		};
		this.registerZoneProvider = function (zoneId, item) {
			var zone = this.zone(zoneId);
			if (!zone.providers.includes(item)) zone.providers.push(item);
			if (!zone.creator) {
				zone.creator = item;
			}
		};
	};

	this.process = function (item) {
		if (typeof item !== "object") item = this.items[item];

		if (!item) throw "No item to process";

		let ren = new this.Rendering(this);
		this.processItem(item, ren, true);

		// Move item content into zones
		var z, zone, i, itemContent;
		for (z in ren.zones) {
			if (ren.zones[z]) { // no assignment in expression - to keep JSHint happy!
				zone = ren.zones[z];
				for (i = 0; i < zone.providers.length; i++) {
					itemContent = zone.providers[i].content[z];
					//zone.content.push(...itemContent);
					zone.content = zone.content.concat(itemContent);
				}
			}
		}

		return ren;
	};

	this.processItem = function (item, ren, processParent) {
		if (item) {
			// Add the specified item
			ren.addItem(item);

			// Optionally process parent
			if (processParent && item.parentId) {
				var parent = this.item(item.parentId);
				this.processItem(parent, ren, true);
			}

			// If not already set root then set it now
			ren.root = ren.root || item;

			// Register a zones provider/consumer
			var z, i, content, ref;
			for (z in item.content) {
				if (item.content[z]) { // no assignment in expression - to keep JSHint happy!
					content = item.content[z];
					// Register as zone provider
					ren.registerZoneProvider(z, item);
					// Register as zone consumer where applicable
					for (i = 0; i < content.length; i++) {
						ref = content[i];
						if (ref) {
							if (ref instanceof this.Ref && ref.type == "zone") {
								ren.registerZoneProvider(ref.id, item);
							}
						}
					}
				}
			}

			// Process child items
			this.log("Adding child items for:", item);
			for (i = 0; i < item.relatedItems.length; i++) {
				var child = this.item(item.relatedItems[i]);
				this.log("Child #" + i + " '" + item.relatedItems[i] + "':", child);
				if (child) {
					this.processItem(child, ren, false);
				}
			}
		}
	};

	this.render = function (ren, zoneId) {
		var html = "";
		var zone = ren.zone(zoneId);

		if (zone) {
			this.log("Rendering zone:", zone);
			html += this.renderZone(ren, zone);
		}

		return html;
	};

	this.renderZone = function (ren, zone) {
		if (zone.html) {
			this.log(`render zone ${zone.id} from cache`);
		} else {
			this.log(`render zone ${zone.id}`);
			for (var c = 0; c < zone.content.length; c++) {
				var content = zone.content[c];
				this.log(`${c} ... ${typeof (content)}`);
				switch (typeof (content)) {
					case "string":
						zone.html += content;
						break;
					case "function":
						zone.html += content(ren);
						break;
					case "object":
						let render_html = "";
						if (content instanceof this.Ref) {
							if (content.type == "zone") {
								var rz = ren.zone(content.id);
								render_html = this.renderZone(ren, rz);
							}
							if (content.type == "media") {
								render_html = this.renderMediaItem(content.id);
							}
							if (content.type == "func") {
								let fn = this.referenceFunctionByName(content.id);
								let result = fn(ren, content.func_args);
								if (Array.isArray(result)) {
									render_html = (content.inner_template ? result.map(htm => content.inner_template.replace("[[ITEM]]", htm)) : result).join("");
								} else {
									render_html = result.toString();
								}
							}
						}
						else {
							render_html = content.toString(ren);
						}

						if (render_html && content.outer_template) {
							render_html = content.outer_template.replace("[[CONTENT]]", render_html);
						}

						if (!render_html && content.none_replacement) {
							render_html = content.none_replacement;
						}

						zone.html += render_html;
						break;
				}
			}
		}
		this.log(`<< ${zone.html}`);
		return zone.html;
	};

	this.renderMediaItem = function (media_id) {
		let m = this.media(media_id);
		let htm = "";
		if (m) {
			switch (m.type) {
				case "img":
				case "image":
				case "jpg":
				case "png":
				case "gif":
					htm = `<img src="${m.url}" alt="${m.title}" />`;
			}
		}
		return htm;
	};

	this.parseContent = function (raw) {
		var result = [];
		var tokenStart = 0, tokenEnd = 0, token, match;
		while (true) {
			// find tokens with {{ }} delimiters
			tokenStart = raw.indexOf("{{");
			tokenEnd = raw.indexOf("}}");
			if (tokenStart > -1 && tokenEnd > tokenStart) {
				// Pre-token
				if (tokenStart > 0) {
					result.push(raw.substring(0, tokenStart)); // keep the content prior to the token
				}
				// Token
				token = raw.substring(tokenStart, tokenEnd + 2);
				match = token.match(/{{(\w+?):([\w-\._]+?)(?:\s+(.*?))?}}/);
				if (match) {
					// token is type:id
					result.push(new this.Ref(match[1], match[2], match[3])); // keep the parsed token
				}
				// Post-token
				raw = raw.substring(tokenEnd + 2); // continue processing from the end of the token
			} else {
				break;
			}
		}
		if (raw) {
			result.push(raw); // keep the remainder
		}
		return result;
	};

	this.log = (str, obj) => this.logEnabled ? console.log(str) || (obj ? console.log(obj) : null) : null;

	this.referenceFunctionByName = global_func_name => global_func_name.split(".").reduce((context, name) => context[name], window);

};
