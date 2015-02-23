/* global $:false -- jQuery. */

// define(function (require) {
// 	var yaml = require("./js-yaml.js");

function GameFunction (fname, params) {
	this.fn = Game[fname];
	this.params = params;
}
GameFunction.prototype.evaluate = function () {
	return this.fn.apply(window.game, this.params);
}

	
var GameFunctionType = new jsyaml.Type("!do", {
	kind: "mapping",
	instanceOf: GameFunction,
	resolve: function (data) {
		return data !== null && data.hasOwnProperty("call"); 
	},
	construct: function (data) {
		var args = data['pass'] || [];
		return new GameFunction(data.call, args);
	}
});
	
function EncodedLink (data) {
	this.data = data;
}
EncodedLink.prototype.evaluate = function () {
	var content = this.data.content;
	if ( content instanceof Object
		&& content.constructor.prototype.hasOwnProperty("evaluate") ) {
		content = content.evaluate();
	}
	delete this.data.content;
	var href = this.data['href'] || "#";
	delete this.data.href;
	var link = "<a href='" + href + "'"
	for (m in this.data) {
		link = link + " " + m + "='" + this.data[m] + "'"
	}
	link = link + ">" + content + "</a>";
	return link
}

var LinkType = new jsyaml.Type("!link", {
	kind: "mapping",
	instanceOf: EncodedLink,
	resolve: function (data) {
		return data !== null && data.hasOwnProperty("content"); 
	},
	construct: function (data) {
		return new EncodedLink(data);
	}
});

	
var ConcatType = new jsyaml.Type("!concat", {
	kind: "sequence",
	construct: function (data) {
		var str_data = $.collect(data, function (i) {
			var proto = this.constructor.prototype;
			return (proto.hasOwnProperty("evaluate")) ? proto.evaluate.apply(this) : this;
		});
		return str_data.join("");
	}
});

/******************************************************************************/
var GAME_SCHEMA = jsyaml.Schema.create([ GameFunctionType, ConcatType, LinkType ]);
/******************************************************************************/


/*
 * Wrap parsed results in a YAML object, which we can customize (see get method).
 */
function YAML(parsed_data) {
	// crawl through parsed_data & give all objects a custom get() function.
	// for now, we're assuming they're all vanilla Objects.
	for (var key in parsed_data) {
		var constructor = parsed_data[key].constructor;
		if ((parsed_data[key] instanceof Object) && !(parsed_data[key] instanceof Function)) {
			parsed_data[key] = new YAML(parsed_data[key]);
		}
	}
	$.extend(this, parsed_data);
}

/*
 * Return the numbef of items remaining in a YAML array.
 */
YAML.prototype.count = function () {
	var keys = Object.keys(this);
	keys = $(keys).reject(function () { return ["default_context"].indexOf(this.toString()) > -1; });
	return keys.length;
};

/*
 * YAML.get() method, to be more forgiving about object keys, and to evaluate functions named in the YAML.
 */
YAML.prototype.get = function (key) {
	key = key.toString();
	var value;
	
	if (this.hasOwnProperty(key)) {
		value = this[key];
	} else if (this.hasOwnProperty(key.underscore())) {
		value = this[key.underscore()];
	} else if (this.hasOwnProperty(key.camelize(false))) {
		value = this[key.camelize(false)];
	} else {
		// console.log("Could not find " + key + " in ", this);
		return undefined;
	}
	if (value.hasOwnProperty('evaluate') && (typeof value.evaluate === 'function')){
		return value.evaluate();
	} else {
		return value;
	}
};

YAML.prototype.shift = function () {
	return Array.prototype.shift.call(this);
};


// don't show custom functions when the object is listed.
Object.defineProperty(YAML.prototype, "get", {
	enumerable: false
});
Object.defineProperty(YAML.prototype, "readOrEvaluate", {
	enumerable: false
});
Object.defineProperty(YAML.prototype, "shift", {
	enumerable: false
});
Object.defineProperty(YAML.prototype, "count", {
	enumerable: false
});

// be compatible with objects and arrays.
Object.defineProperty(YAML.prototype, "length", {
	enumerable: false,
	get: function () {
		// count enumerable elements.
		var i = 0;
		for (var key in this) {
			if (this.hasOwnProperty(key)) { i++; }
		}
		return i;
	},
	set: function (val) {
		if (!val) {
			throw new Error("Can't set object length to " + val);
		}
	}
});