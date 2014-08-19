/*
 *** Utilities.
 */

// put an action off until the current calling chain has completed.
function defer(f, context){
  setTimeout(f.bind(context));
}


function playmp3(name){
    var audioElement = document.createElement('audio');
    audioElement.setAttribute('src', media_url+"game/sounds/"+name+".mp3");
    audioElement.load();
    audioElement.addEventListener("canplay", function() {
      console.log("playing","'"+name+"'")
      audioElement.play();
    });
}

// our tokens are of the form ':<token_name>'.
String.prototype.insert_values = function(){
	var tokens = this.match(/(?:\:)\w+/g);
	var str = this;
	var args = Array.prototype.slice.call(arguments, 0);
	
	// use arguments to replace tokens. leave any tokens not covered by an argument
	$(tokens).each(function(){
		if (args.length){
			str = str.replace(new RegExp(this), args.shift())
		}
	});
	return str
}

// WAY too simple past_tense function, but it will do for now.
String.prototype.past_tense = function(){
	var last_char = this.slice(-1);
	if (['a','e','i','o','u'].indexOf(last_char) != -1){
		return this + "d";
	} else {
		return this + "ed";
	}
}