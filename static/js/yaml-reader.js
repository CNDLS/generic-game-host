/* global $:false -- jQuery. */

// define(function (require) {
// 	var yaml = require("./js-yaml.js");

function GameFunction(fname, params) {
	this.fn = Game[fname];
	this.params = params;
}
GameFunction.prototype.evaluate = function(){
	return this.fn.apply(window.game, this.params);
}

	
var GameFunctionType = new jsyaml.Type("!evaluate", {
	kind: "mapping",
	instanceOf: GameFunction,
	resolve: function (data) {
		return data !== null && data.hasOwnProperty("call"); 
	},
	construct: function (data) {
		var args = data['pass'] || [];
		var gf = new GameFunction(data.call, args);
		return gf;
	}
});
var GAME_SCHEMA = jsyaml.Schema.create([ GameFunctionType ]);

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

// YAML.prototype.evaluate = function (value, context, args) {
// 	if (context && context.hasOwnProperty(value) && (typeof context[value] === "function")) {
// 		// pass any remaining params to the function.
// 		return context[value].apply(args);
// 	} else {
// 		return value;
// 	}
// };

YAML.prototype.shift = function () {
	return Array.prototype.shift.call(this);
};


// don"t show custom functions when the object is listed.
Object.defineProperty(YAML.prototype, "get", {
	enumerable: false
});
Object.defineProperty(YAML.prototype, "readOrEvaluate", {
	enumerable: false
});
Object.defineProperty(YAML.prototype, "shift", {
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