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
$.fn.render = function (spec) {
	var _this = this;
	
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
	
	
	// function to turn a descriptor into an empty HTML element.
	// successful matches are of the form: [<whole str>, <tag name>, <id>, <class names separated by .>]
	function createElement(str) {
		var matches = tag_id_class_regexp.exec(str);
		var tag_name, el, id, classnames;
		var dfd = $.Deferred();
		
		if (matches === null) {
			return str; // probably a space in the text.
		} else {
			tag_name = matches[1] || "div"; // so we can use descriptors that are just ids and/or class names.
			el = $(document.createElement(tag_name));
			
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
								// we pull the contents of the src file
								// and use it to replace the <svg> element.
								$.ajax(MEDIA_URL + "uploads/custom_img/" + attr_value, { crossDomain: true })
								.done(function (svg_file) {
									var svg_file_jQ = $(svg_file.documentElement);
									el.replaceWith(svg_file_jQ);
									for (saved_attr_key in attrs_obj) {
										if (saved_attr_key != "src") {
											el.attr(saved_attr_key, attr_value);
										}
									}
									dfd.resolve();
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
								el.attr(attr_key, MEDIA_URL + "uploads/custom_img/" + attr_value);
								// resolve once the image has been loaded.
								el.get(0).onload = function (evt) {
									dfd.resolve();
								}
							}
							break;
							
						default:
							dfd.resolve();
							break;
					}
				}
			}
			
			el.data({ promise: dfd.promise() });
			return el;
		}
	}
	
	
	// processing the spec based on type.
	switch (typeof spec) {
		case "string":
			// is_valid_html will return true for vanilla strings (eg; "some text"), 
			// which are, in fact, valid HTML.
			// we have to exclude our tag descriptors, though.
			if (spec.is_valid_html() && !tag_id_class_regexp.test(spec)) {
				return $(this).html(spec);
			} else {
				var el = createElement(spec);
				$(this).append(el);
				return el;
			}
			break;
			
		case "object":
			if (spec instanceof Array) {
				for (var item in spec) {
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
						promises.push(el.data("promise"));
					}
					// recurse into complex objects.
					$(el).render(spec[key]);
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