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
      return try_func.call(context);
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


Object.hasFunction = function (obj, fname) {
	return (obj.constructor.hasOwnProperty(fname) && typeof obj.constructor[fname] === "function");
}

// return an array with no duplicates.
Array.getUnique = function(arr){
   var u = {}, a = [];
   for (var i = 0, l = arr.length; i < l; ++i) {
      if (u.hasOwnProperty(arr[i])) {
         continue;
      }
      a.push(arr[i]);
      u[arr[i]] = 1;
   }
   return a;
}

Util = {
	extend_properties: function (child, parent) {
		for (m in parent) {
			if (typeof parent[m] !== "function") {
				child[m] = parent[m];
			}
		}
	},
	
	extendClass: function (superclass, subclass, prototype_extension) {
		"use strict";

		function o() { this.constructor = subclass; }
		o.prototype = superclass.prototype;
        subclass.prototype = $.extend(new o(), prototype_extension || {});
		return subclass;
	},
  
  // extend() is deprecated. 9/27/15 bg.
	extend: function (subclass, superclass) {
		"use strict";

		function o() { this.constructor = subclass; }
		o.prototype = superclass.prototype;
		return (subclass.prototype = new o());
	},
	
	clone: function (src_fn) {
		var temp = function () { return src_fn.apply(this, arguments); };
		for(var key in src_fn) {
		    if (src_fn.hasOwnProperty(key)) {
		        temp[key] = src_fn[key];
		    }
		}
		return temp;
	},
	
	isNumeric: function (val) {
		return !isNaN(parseFloat(val)) && isFinite(val);
	},
	
	numberArrayFromTokenList: function (tokenList) {
		var r = /(?:\.\.)*\d+/g;
		var number_tokens = tokenList.match(r);
		var output_array = [];
		$(number_tokens).each(function (i) {
			var n = parseInt(this.replace("..", ""));
			if (this.match(/\.\./) !== null) {
				var prev_n = parseInt(number_tokens[i-1]);
				if (!isNaN(prev_n) && !isNaN(n)) {
					for (j=prev_n+1; j<=n; ++j) {
						output_array.push(j);
					}
				}
			} else {
				output_array.push(n);
			}
		});
		return output_array;
	}, 
	
	replaceAll: function (item, pattern, replacement_str) {
		switch (typeof item) {
			case "string":
				return item.replace(pattern, replacement_str);
				break;
			
			case "object":
				if (item instanceof String) {
					return item.toString().replace(pattern, replacement_str);
				} else if (item instanceof Array) {
					for (var i=0; i < item.length; i++) {
						item[i] = Util.replaceAll(item[i], pattern, replacement_str);
					}
				} else if (item instanceof HTMLElement) {
          return item;
        } else {
					// do any replacements in keys.
					var keys = Object.keys(item);
					var tmp_key;
					for (var i=0; i < keys.length; i++) {
						tmp_key = Util.replaceAll(keys[i], pattern, replacement_str);
						if (tmp_key !== keys[i]) {
							item[tmp_key] = item[keys[i]];
							delete item[keys[i]];
						}
					}
					// do any replacements in values.
					for (var m in item) {
						item[m] = Util.replaceAll(item[m], pattern, replacement_str);
					}
				}
				return item;
				break;
        
      case "boolean":
      case "number":
      case "undefined":
        return item;
				
			default:
				throw new Error("Cannot do replacments on item: " + item);
				break;
		}
	},
	
	createDescriptor: function (htmlElement) {
		if (htmlElement instanceof HTMLElement) {
			var descriptor = htmlElement.nodeName.toLowerCase();
			if (htmlElement.id) { descriptor += ("#" + htmlElement.id); }
			descriptor += ("." + ($(htmlElement).attr("class") || "").replace(/\s/g, "."));
			return descriptor;
		} else {
		  throw Error("Cannot create descriptor for non-HTMLElement.");
		}
	}
}