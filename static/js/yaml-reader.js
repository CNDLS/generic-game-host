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



function ConditionalResult (data) {
  this.key_expr = data[0];
  this.dict = data[1];
  this.fn = function (key) {
    try {
      return this.dict[key];
    } catch (e) {
      console.warn("Cannot find '" + key + "' in dictionary obj.", this.dict);
      return;
    }
  }
}
// we're asked to evaluate elements that may have dot notation.
// these should only be things that are members (and sub-members) of context.
ConditionalResult.prototype.evaluate = function (context) {
  try {
    var key_expr_elements = this.key_expr.match(/(\w+(?=\.){0,1})/g);
    var key = context; // drill down, starting w context.
    for (var i=0; i<key_expr_elements.length; i++) {
      key = key[key_expr_elements[i]];
    }
  	return this.fn(key);
  } catch (e) {
    console.warn(e);
    return;
  }
}

var ConditionalResultType = new jsyaml.Type("!when", {
	kind: "sequence",
  instanceOf: ConditionalResult,
	resolve: function (data) {
    // this type is picky: data must be an array of exactly two members,
    // first, something that resolves to a string, and second, and object.
    is_valid = false;
    if ((data instanceof Array) && (data.length === 2)) {
      if ((typeof data[0] === "string") && (typeof data[1] === "object")) {
        is_valid = true;
      } 
    }
    return is_valid;
	},
	construct: function (data) {
    return new ConditionalResult(data);
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
		// we make this assumption because we are concatenating a string.
		// any YAML for this purpose that has not be resolved into a string by its evaluate() function
		// is likely to be an html spec.
		try  {
			if (item instanceof YAML) { item = $.render(item).html; }
		} catch (e) {
			console.log("Cannot concatenate YAML, because it could not be rendered into HTML.", e);
		}
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
var GAME_SCHEMA = jsyaml.Schema.create([ GameFunctionType, ConcatType, LinkType, ConditionalResultType ]);
/******************************************************************************/


/*
 * Wrap parsed results in a YAML object, which we can customize (see get method).
 */
function YAML(parsed_data) {
    if (parsed_data.hasOwnProperty("yaml_src")) {
        this.yaml_src = parsed_data.yaml_src;
        delete parsed_data.yaml_src;
    }
    
	// crawl through parsed_data & give all objects a custom get() function.
	// for now, we're assuming they're all vanilla Objects.
    var member;
	for (var key in parsed_data) {
        member = parsed_data[key];
		if ((member instanceof Object) && !(member instanceof Function)) {
			parsed_data[key] = new YAML(member);
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
YAML.prototype.get = function (key, context) {
	var value;
	key = key.toString();
  if (key.match(/^\(.+\)$/g)) { // key is in parens.
    var key_expr_elements = this.key_expr.match(/(\w+(?=\.){0,1})/g);  // key is of the form (a.b..x)
    var value = context; // drill down, starting w context.
    for (var i=0; i<key_expr_elements.length; i++) {
      value = value[key_expr_elements[i]];
    }
    return value;
  }
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
		return value.evaluate(context);
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
$.each(["get", "shift", "join", "readOrEvaluate", "indexOf", "count", "equals", "yaml_src"], function(){
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