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


function FunctionSequence (data) {
  this.fnames = data;
}
// make a promise for each fname in my list.
// resolve the fname to a fn, and call it upon the promise resolving.
FunctionSequence.prototype.evaluate = function (context) {
  var _this = this;
  return function enactSequence () {
    var dfd = $.Deferred();
    dfd.resolve();
    var p = dfd.promise();
    var fname, fn;
    var fn_context = context;
    for (var i=0; i < _this.fnames.length; i++) {
      fname = _this.fnames[i];
      fn = YAML.prototype.get(fname, context);
      // use the second-last element of fname (eg; game, if fname is '(game.end)')
      // to set the context in which fn gets executed.
      fname = fname.replace("(", "").replace(")", "");
      var fname_arr = fname.split(".");
      fname_arr.pop();
      if (fname_arr !== []) {
        fn_context = YAML.prototype.get("(" + fname_arr.join(".") + ")", context);
      }
      if (typeof fn === "function") {
        dfd = $.Deferred();
        p = p.then(fn.call(fn_context));
      }
    }
    return dfd;
  }
}
	
var FunctionSequenceType = new jsyaml.Type("!call", {
	kind: "sequence",
  instanceOf: FunctionSequence,
	resolve: function (data) {
    var is_valid = false;
    if (data instanceof Array) {
      is_valid = true; // provisionally
      for (var i=0; i<data.length; i++) {
        if (typeof data[i] !== "string") {
          is_valid = false;
        }
      }
    }
    return is_valid;
  },
	construct: function (data) {
    return new FunctionSequence(data);
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


function ConditionalOnElement (data) {
  this.game_element_selector = data.shift();
  this.options = data;
}

ConditionalOnElement.prototype.evaluate = function (context) {
  var game_element = YAML.prototype.get.call(this, this.game_element_selector, context);
  var option;
  for (var i=0; i < this.options.length; i++) {
    option = this.options[i];
    for (var m in option) {
      if ($(m).is(game_element)) {
       return option[m];
      }
    }
  }
}
	
var ConditionalOnElementType = new jsyaml.Type("!whenElement", {
	kind: "sequence",
  instanceOf: ConditionalOnElement,
	resolve: function (data) {
    if (!(data instanceof Array)) { return false; }
    if (data.length < 2) { return false; }
    if (typeof data[0] !== "string") { return false; }
    return true;
  },
	construct: function (data) {
    return new ConditionalOnElement(data);
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
var GAME_SCHEMA = jsyaml.Schema.create([ GameFunctionType, ConcatType, LinkType, ConditionalResultType, ConditionalOnElementType, FunctionSequenceType ]);
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
		if ((member instanceof Object) && (typeof member !== "function")) {
      if (member instanceof Array) {
        parsed_data[key] = new YAML.Array(member);
      } else  {
  			parsed_data[key] = new YAML(member);
      }
		}
	}
	$.extend(this, parsed_data);
}

/*
 * Just give ourselves a way to type-check YAML arrays.
 */
YAML.Array = Util.extendClass(YAML, function YAML_Array (parsed_data) {
  YAML.call(this, parsed_data);
});

/*
 * Return the numbef of items remaining in a YAML array.
 */
YAML.Array.prototype.count = function () {
	var keys = Object.keys(this);
	keys = $(keys).reject(function () { return ["default_context"].indexOf(this.toString()) > -1; });
	return keys.length;
};
YAML.Array.prototype.shift = function () {
	return Array.prototype.shift.call(this);
};

YAML.Array.prototype.join = function () {
	return Array.prototype.join.call(this);
};

YAML.Array.prototype.indexOf = function (obj) {
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

// be compatible with objects and arrays.
Object.defineProperty(YAML.Array.prototype, "length", {
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

/*
 * YAML.get() method, to be more forgiving about object keys, and to evaluate functions named in the YAML.
 */
YAML.prototype.get = function (key, context) {
	var value;
	key = key.toString();
  if (key.match(/^\(.+\)$/g)) { // key is in parens.
    var key_expr_elements = key.match(/(\w+(?=\.){0,1})/g);  // key is of the form (a.b..x)
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
  if ((value === undefined) || (value === null)) {
    return;
  }
	if (value.hasOwnProperty('evaluate') && (typeof value.evaluate === 'function')){
		return value.evaluate(context);
	} else if ((typeof value === "string") && (value.match(/^\(.+\)$/g))) { // value is in parens.
    var val_expr_elements = value.match(/(\w+(?=\.){0,1})/g);  // value is of the form (a.b..x)
    var val = context; // drill down, starting w context.
    for (var i=0; i<val_expr_elements.length; i++) {
      val = val[val_expr_elements[i]];
    }
    return val;
  } else {
		return value;
	}
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
$.each(["get", "readOrEvaluate", "equals", "yaml_src"], function(){
	Object.defineProperty(YAML.prototype, this, { enumerable: false });
});
$.each(["shift", "join", "indexOf", "count", "constructor"], function(){
	Object.defineProperty(YAML.Array.prototype, this, { enumerable: false });
});