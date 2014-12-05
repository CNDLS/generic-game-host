/* global $:false -- jQuery. */

define(function (require) {
	var yaml = require("./js-yaml.js");
	
	var FunctionType = new yaml.Type("!evaluate", {
		kind: "sequence",
		construct: function (data) {
			data = data || []; // in case of empty node
			return new FunctionType(data.height || 0, data.width || 0, data.points || []);
		},
		instanceOf: FunctionType
		// `represent` is omitted here. So, Space objects will be dumped as is.
		// That is regular mapping with three key-value pairs but with !space tag.
	});
	var GAME_SCHEMA = yaml.Schema.create([ FunctionType ]);


	(function () {
		if ($ === undefined) { return; }
		this.script_tag = $("script#reader");
		if (this.script_tag.length === 0) { return; }
		this.read_url = this.script_tag.attr("read-from");
	
		$.ajax(
		{
			url: this.read_url,
			type: "GET",
			success: function (data /* , textStatus, XMLHttpRequest */) {
				// send the parsed data to the callback.
				var parsed_game_data;
				try {
					parsed_game_data = new YAML(yaml.safeLoad(data, { schema: GAME_SCHEMA }));
				} catch (err) {
					alert("Warning: cannot parse game file. " + err);
					console.log(err);
					return;
				}
				window.BuildGame(parsed_game_data);
			},
			error: function (XMLHttpRequest, textStatus, errorThrown) {
				console.log(XMLHttpRequest, textStatus, errorThrown);
			}
		});
	})();


	/*
	 * Wrap parsed results in a YAML object, which we can customize (see get method).
	 */
	function YAML(parsed_data) {
		this.default_context = $.noop;
		this.debug = false;
	
		// crawl through parsed_data & give all objects a custom get() function.
		// for now, we"re assuming they"re all vanilla Objects.
		for (var key in parsed_data) {
			if (parsed_data[key] instanceof Object) {
				parsed_data[key] = new YAML(parsed_data[key]);
			}
		}
		$.extend(this, parsed_data);
	}

	/*
	 * Set a default context in which to execute any named functions.
	 */
	YAML.prototype.setDefaultContext = function (context) {
		if (typeof context === "object") { this.default_context = context; }
		else { console.log("failed to setContext(", context); }
	};

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
	YAML.prototype.get = function (key /*, context, function params */) {
		var args = Array.prototype.slice.apply(arguments);
		args.shift().toString(); // var key = 
		var context = args.shift() || this.default_context;
		var value;
	
		if (this.hasOwnProperty(key)) {
			value = this[key];
		} else if (this.hasOwnProperty(key.underscore())) {
			value = this[key.underscore()];
		} else if (this.hasOwnProperty(key.camelize(false))) {
			value = this[key.camelize(false)];
		} else {
			if (this.debug) { console.log("Could not find " + key + " in ", this); }
			return undefined;
		}
		return this.evaluate(value, context, args);
	};

	YAML.prototype.evaluate = function (value, context, args) {
		if (context && context.hasOwnProperty(value) && (typeof context[value] === "function")) {
			// pass any remaining params to the function.
			return context[value].apply(args);
		} else {
			return value;
		}
	};

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
});