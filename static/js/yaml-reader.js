// See node kinds in YAML spec: http://www.yaml.org/spec/1.2/spec.html#kind
var MyFunctionType = new jsyaml.Type('!my', { kind: 'scalar' });
var GAME_SCHEMA = jsyaml.Schema.create([ MyFunctionType ]);


(function(){
	if ($ == undefined){ return; }
	this.script_tag = $("script#reader");
	if (this.script_tag.length == 0){ return; }
	this.read_url = this.script_tag.attr("read-from");
	
	$.ajax({
		url: this.read_url,
		type: "GET",
		success: function(data, textStatus, XMLHttpRequest){ 
			 // send the parsed data to the callback.
			 try {
				 var parsed_game = new YAML(jsyaml.safeLoad(data, { schema: GAME_SCHEMA }));
			 } catch (err){
				 alert("Warning: cannot parse game file. " + err);
				 console.log(err);
				return;
			}
			// build the game.
			try {
				new Game(parsed_game);
			 } catch (err){
				alert("Warning: cannot build game. " + err);
				var obj = {};
				Error.captureStackTrace(obj, this);
				console.log(obj.stack);
				return;
			}
		},
		error: function(XMLHttpRequest, textStatus, errorThrown){
		 console.log(XMLHttpRequest, textStatus, errorThrown);
		}
	});
})();


/*
 * Wrap parsed results in a YAML object, which we can customize (see get method).
 */
function YAML(parsed_data){
	var proto = parsed_data.prototype;
	
	// crawl through parsed_data & give all objects a custom get() function.
	// for now, we're assuming they're all vanilla Objects.
	for (key in parsed_data){
		if (parsed_data[key] instanceof Object){
			parsed_data[key] = new YAML(parsed_data[key]);
		}
	}
	
	var yaml_obj = $.extend(this, parsed_data);
}

/*
 * YAML.get() method, to be more forgiving about object keys.
 */
YAML.prototype.get = function(key, context /*, function params */){
	key = key.toString();
	if (this.hasOwnProperty(key)){
		// if the value returned is the name of a function defined on the given context, exectute it and return the value.
		if (context && context.hasOwnProperty(this[key]) && (typeof context[this[key]] == "function")){
			var params = Array.prototype.slice.apply(arguments);
			// remove key, remove context, and pass any remaining params to the function.
			params.shift();  params.shift();
			return context[this[key]].apply(params);
		} else {
			return this[key];
		}
	} else if (this.hasOwnProperty(key.underscore())){
		return this[key.underscore()];
	} else if (this.hasOwnProperty(key.camelize(false))){
		return this[key.camelize(false)];
	} else {
		console.log("Could not find '"+key+"' in ",this);
		return false;
	}
}

YAML.prototype.shift = function(){
	console.log((this))
	return Array.prototype.shift.call(this);
}


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

// be compatible with objects and arrays.
Object.defineProperty(YAML.prototype, "length", {
    enumerable: false,
    get: function() {
			// count enumerable elements.
			var i = 0;
			for (var key in this){ i++ }
			return i;
		},
		set: function(val) {
			if (!val) {
				throw new Error("Can't set object length to " + val);
			}
		}
});