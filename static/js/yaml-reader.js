/* global $:false -- jQuery. */

// define(function (require) {
// 	var yaml = require("./js-yaml.js");

function GameFunction (fname, params) {
	if (typeof Game[fname] != "function") {
		throw new Error("Cannot find " + fname + "() function on the Game object.")
	}
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
	
	var href = this.data['href'] || "#";
	var classnames = this.data['class'] || "";
	if (classnames){
		var link = "<a class='" + classnames + "' href='" + href + "'";
	} else {
		var link = "<a href='" + href + "'";
	}
	
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


function Concat (data) {
	data.unshift([]);
	this.data = Array.prototype.reduce.call(data, function (a, b) {
		return a.concat(b);
	});
}
Concat.prototype.evaluate = function () {
	this.str_data = $.collect(this.data, function (i) {
		var item = (this["evaluate"] instanceof Function) ? this.evaluate() : this;
		return item;
	});
	return this.str_data.join("");
}

var ConcatType = new jsyaml.Type("!concat", {
	kind: "sequence",
	instanceOf: Concat,
	resolve: function (data) {
		return data instanceof Array; 
	},
	construct: function (data) {
		return new Concat(data);
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

YAML.prototype.join = function () {
	return Array.prototype.join.call(this);
};

YAML.prototype.indexOf = function (obj) {
	var i = 0;
	for (var m in this) {
		if ( (this[m] instanceof YAML) && (this[m].equals(obj)) ) {
			return i;
		} else if (this[m] === obj) {
			return i;
		}
		i++;
	}
	return -1;
};

YAML.prototype.equals = function (obj) {
	if (obj === undefined) {
		return false;
	}
	if (obj['constructor'] && (obj['constructor'] !== this.constructor)) {
		return false;
	}
	// loop through my members; check against each member.
	// try out members being equal; any failure of this[m].equals(obj[m]) will negate that.
	var members_are_equal = true;
	for (var m in this) {
		if (this[m] instanceof YAML) {
			members_are_equal = members_are_equal && (this[m].equals(obj[m]));
		} else if (this[m] !== obj[m]) {
			return false;
		}
	}
	return members_are_equal;
}

// don't show custom functions when the object is listed.
$.each(["get", "shift", "join", "readOrEvaluate", "indexOf", "count", "equals"], function(){
	Object.defineProperty(YAML.prototype, this, { enumerable: false });
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