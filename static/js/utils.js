/* global $:false -- jQuery. */
/* global media_url:false -- provided by the page. */
/* jshint unused:false */

/*
 *** Utilities.
 */

function playmp3(name) {
    var audioElement = document.createElement("audio");
    audioElement.setAttribute("src", media_url + "game/sounds/" + name + ".mp3");
    audioElement.load();
    audioElement.addEventListener("canplay", function () {
		console.log("playing", "'" + name + "'");
		audioElement.play();
    });
}

/***** establish a 'development' environment mode for differences in error reporting. *****/
function in_production_try(context, try_func, catch_func) {
	if (!window.hasOwnProperty("environment") 
		|| !typeof window.environment === "object"
		|| !window.environment.hasOwnProperty("mode") ) {
		window.environment = { mode: "production" }
	}
	context = context || window;
	switch (window.environment.mode) {
		case "production":
			try {
				return try_func.call(context);
			} catch (e) {
				Error.captureStackTrace(e);
				console.log(e.stack);
				if (catch_func) catch_func.call(context, e);
			}
			break;
			
		case "development":
			try {
				return try_func.call(context);
			} catch (e) {
				console.error(e.stack);
				debugger; // allow failure to interrupt execution & drop into debugger.
			}
			break;
	}
}


// our tokens are of the form ":<token_name>".
String.prototype.insert_values = function () {
	var tokens = this.match(/(?:\:)\w+/g);
	var str = this;
	var args = Array.prototype.slice.call(arguments, 0);
	
	// use arguments to replace tokens. leave any tokens not covered by an argument
	$(tokens).each(function () {
		if (args.length) {
			str = str.replace(new RegExp(this), args.shift());
		}
	});
	return str.toString();
};

// WAY too simple past_tense function, but it will do for now.
String.prototype.past_tense = function () {
	var last_char = this.slice(-1);
	if (["a", "e", "i", "o", "u"].indexOf(last_char) !== -1) {
		return this + "d";
	} else {
		return this + "ed";
	}
};

// test string to see if it contains html tags & is formatted correctly.
/*** requires jQuery ***/
String.prototype.is_valid_html = function () {
	var test_div = $('<div/>');
	test_div.html(this);
	return (test_div[0].childNodes.length) ? true : false;
}


// return an arraty with no duplicates.
Array.prototype.getUnique = function(){
   var u = {}, a = [];
   for(var i = 0, l = this.length; i < l; ++i){
      if(u.hasOwnProperty(this[i])) {
         continue;
      }
      a.push(this[i]);
      u[this[i]] = 1;
   }
   return a;
}

Util = {
	extend_properties: function(child, parent) {
		for (m in parent) {
			if (typeof parent[m] !== "function") {
				child[m] = parent[m];
			}
		}
	},
	
	extend: function(subclass, superclass) {
		"use strict";

		function o() { this.constructor = subclass; }
		o.prototype = superclass.prototype;
		return (subclass.prototype = new o());
	}
}



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
	if (spec instanceof jQuery) {
		return spec;
	}
	// test of whether we can apply a string to our function for creating tags.
	// string must be of the form tag[#id][.class]
	// optional conditions are so it will match either or both id and classnames.
	// 6/15 -- this will now also trap any attributes (to be parsed by a separate regexp).
	var tag_id_class_regexp = /^(\w+)?(#\w+)?((?:\.\w[^\[]+)*)?(\[\S+=\S+\])*$/;
	
	// function to turn a descriptor into an empty HTML element.
	// successful matches are of the form: [<whole str>, <tag name>, <id>, <class names separated by .>]
	function createElement(str) {
		var matches = tag_id_class_regexp.exec(str);
		if (matches === null) {
			return str; // probably a space in the text.
		} else {
			var tag_name, el, id, classnames;
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
					attrs_obj[attr_key] = attr_value
					// special case of svg element with src attribute: we pull the contents of the src file
					// and use it to replace the <svg> element.
					if ((tag_name == "svg") && (attr_key == "src")) {
						$.ajax(STATIC_URL + attr_value, { crossDomain: true })
						.done(function (svg_file) {
							var svg_file_jQ = $(svg_file.documentElement);
							el.replaceWith(svg_file_jQ);
							for (saved_attr_key in attrs_obj) {
								if (saved_attr_key != "src") {
									svg_file_jQ.attr(saved_attr_key, attr_value);
								}
							}
						})
						.fail(function () {
							// convert svg tag to an object tag w src as data attr...?
							// Does this make a good fallback? I guess it depends on the reason for the ajax failure.
							
						})
					}
				}
			}
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
				$(this).append(createElement(spec));
				return $(this).children().last();
			}
			break;
			
		case "object":
			if (spec instanceof Array) {
				for (var item in spec) {
					if (spec instanceof HTMLElement) {
						$(this).append(item);
					} else {
						$(this).append(createElement(item));
					}
				}
			} else if (spec instanceof HTMLElement) {
				$(this).append(spec);
			} else {
				var keys = Object.keys(spec);
				var key;
				for (var i=0; i<keys.length; i++) {
					key = keys[i];
					var el = createElement(key);
					// recurse into complex objects.
					$(el).render(spec[key]);
					$(this).append(el);
				}
			}
			return $(this).children().last();
			break;
			
		case "number":
			return $(this).html(spec);
			break;
	}
	
	return this;
}