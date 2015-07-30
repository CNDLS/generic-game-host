/************************************************************
 * jQuery plugin for rendering a spec object into HTML.
 * As we work through the passed-in spec object,
 * we need to be able to handle strings of the form tag[#id][.class],
 * fragments of valid HTML, and text content.
 * We need to traverse members of the object and recurse into 
 * any members that are objects themselves. Becase we can
 * recurse, remember that any data type might be passed in as spec
 * in a given recursion.
 ************************************************************/
$.render = function (spec) {
	var div = $("<div/>");
	return { promise: div.render(spec).data("promise"), html: div.html() }
}

$.fn.render = function (spec) {
	var _this = this;
	
	// create a dfd to make sure we always have at least one promise.
	// make sure we're not waiting for it, though. 
	// this is just for the syntax for $.when.apply()
	var default_dfd = $.Deferred();
	var element_load_promises = [default_dfd.promise()];
	default_dfd.resolve();
	
	if (spec instanceof jQuery) {
		return spec;
	}
	// test of whether we can apply a string to our function for creating tags.
	// string must be of the form tag[#id][.class]
	// optional conditions are so it will match either or both id and classnames.
	// 6/15 -- this will now also trap any attributes (to be parsed by a separate regexp).
	// Oof. Regex's are hard, in part because there's no room for comments.
	// Here is a breakdown of the capture groups:
	// (\w+)? == optional tag name (default is div).
	// (#\w[^\.\[]+)? == optional id, leading up to either a list of class names or a list of attributes
	// ((?:\.\w[^\[]+)*)? == optional list of class names -- not capturing individual class names, just the whole list.
	// ... note about above: you need both the * for matching 0 or more, and the ?, in order to get the whole thing & yet leave it optional.
	// (\[\S+=\S+\])* == 0 or more attributes. done. whew.
	var tag_id_class_regexp = /^(\w+)?(#\w[^\.\[]+)?((?:\.\w[^\[]+)*)?(\[\S+=\S+\])*$/;
	
	var valid_html_tags = ["A", "ABBR", "ACRONYM", "ADDRESS", "APPLET", "AREA", "B", "BASE", "BASEFONT", "BDO", "BIG", "BLOCKQUOTE", "BODY", "BR", "BUTTON", "CAPTION", "CENTER", "CITE", "CODE", "COL", "COLGROUP", "DD", "DEL", "DFN", "DIR", "DIV", "DL", "DT", "EM", "FIELDSET", "FONT", "FORM", "FRAME", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEAD", "HR", "HTML", "I", "IFRAME", "IMG", "INPUT", "INS", "ISINDEX", "KBD", "LABEL", "LEGEND", "LI", "LINK", "MAP", "MENU", "META", "NOFRAMES", "NOSCRIPT", "OBJECT", "OL", "OPTGROUP", "OPTION", "P", "PARAM", "PRE", "Q", "S", "SAMP", "SCRIPT", "SELECT", "SMALL", "SPAN", "STRIKE", "STRONG", "STYLE", "SUB", "SUP", "TABLE", "TBODY", "TD", "TEXTAREA", "TFOOT", "TH", "THEAD", "TITLE", "TR", "TT", "U", "UL", "VAR"]
	
	
	// test whether str can be added to an HTML element.
	function is_valid_html (str) {
		var test_div = $('<div/>');
		test_div.html(str);
		return (test_div[0].childNodes.length) ? true : false;
	}
	
	
	// function to turn a descriptor into an empty HTML element.
	// successful matches are of the form: [<whole str>, <tag name>, <id>, <class names separated by .>]
	function createElement (str) {
		var matches = tag_id_class_regexp.exec(str);
		var tag_name, el, id, classnames;
		var dfd = $.Deferred();
		
		if (matches === null) {
			return str; // probably a space in the text.
		} else {
			tag_name = matches[1] || "div"; // so we can use descriptors that are just ids and/or class names.
			if (tag_name === "svg") {
				// make a div to hold the loaded svg.
				el = $(document.createElement("div"));
				el.addClass("svg");
			} else if (valid_html_tags.indexOf(tag_name.toUpperCase()) > -1) {
				el = $(document.createElement(tag_name));
			} else {
				return str;
			}
			
			if (id = matches[2]) {
				el.attr("id", id.replace("#", ""));
			}
			if (classnames = matches[3]) {
				el.addClass(classnames.split(".").join(" "));
			}
			var attributes = matches[4];
			if (attributes) {
				var attr_regexp = /(\[([^=]+)=([^\]]+)\])/g;
				var attr_spec;
				var attrs_obj = {};
				while (attr_spec = attr_regexp.exec(attributes)) {
					var attr_key = attr_spec[2];
					var attr_value = attr_spec[3];
					el.attr(attr_key, attr_value);
					attrs_obj[attr_key] = attr_value;
					
					// special cases: content that must be loaded after element is created.
					switch (tag_name) {
						case "svg":
							if (attr_key === "src") {
								var svg_dfd = $.Deferred();
								var svg_promise = svg_dfd.promise();
								element_load_promises.push(svg_promise);
								// we pull the contents of the src file
								// and use it to replace the <svg> element.
								$.ajax(attr_value, { crossDomain: true })
								.then(function (svg_file) {
									var svg_file_jQ = $(svg_file.documentElement);
									// put svg file root node into element.
									var svg_root_element = document.importNode(svg_file.documentElement,true);
									el.append(svg_root_element);
									el.data({ promise: svg_promise });
									// give added elements a chance to show up in the DOM.
									svg_dfd.resolve();
								})
								.fail(function () {
									// convert svg tag to an object tag w src as data attr...?
									// Does this make a good fallback? I guess it depends on the reason for the ajax failure.
									dfd.fail();
								})
							}
							break;
						
						case "img":
							if (attr_key === "src") {
								var img_dfd = $.Deferred();
								var img_promise = img_dfd.promise();
								element_load_promises.push(img_promise);
								el.attr(attr_key, attr_value);
								// resolve once the image has been loaded.
								el.get(0).onload = function (evt) {
									img_dfd.resolve();
								}
							}
							break;
							
						default:
							dfd.resolve();
							break;
					}
				}
			} else {
				dfd.resolve(); // no atrributes.
			}
			$.when.apply($, element_load_promises).done(function () { console.log("done", element_load_promises.length, el) });
			el.data({ promise: $.when.apply($, element_load_promises) });
			return el;
		}
	}
	
	
	// processing the spec based on type.
	switch (typeof spec) {
		case "string":
			// is_valid_html will return true for vanilla strings (eg; "some text"), 
			// which are, in fact, valid HTML.
			// we have to exclude our tag descriptors, though.
			if (is_valid_html(spec)) {
				if (tag_id_class_regexp.test(spec)) {
					var el = createElement(spec);
					$(this).append(el);
					return el;
				} else {
					return $(this).html(spec);
				}
			} else {
				console.warn("Invalid content passed to jQuery render()", spec);
			}
			break;
			
		case "object":
			if (spec instanceof Array) {
				for (var i=0; i<spec.length; i++) {
					var item = spec[i];
					if (spec instanceof HTMLElement) {
						$(this).append(item);
					} else {
						var el = createElement(item);
						$(this).append(el);
					}
				}
			} else if (spec instanceof HTMLElement) {
				$(this).append(spec);
			} else {
				var keys = Object.keys(spec);
				var key;
				var promises = [];
				for (var i=0; i<keys.length; i++) {
					key = keys[i];
					// check if this is an Array or Array-like object.
					if (parseInt(key) === i) {
						// do nothing. the key is just the ordinal of the element.
						// el is the current this.
						var el = this;
					} else {
						var el = createElement(key);
					}
					// recurse into complex objects.
					if (typeof spec[key] === "string") {
						$(el).append(createElement(spec[key]));
					} else {
						$(el).render(spec[key]);
					}
					promises.push(el.data("promise"));
					$(this).append(el);
				}
			}
			
			// make a promise that encapsulates all the collected promises.
			this.data({ promise: $.when.apply($, promises) });
			break;
			
		case "number":
			return $(this).html(spec);
			break;
	}
	return this;
}