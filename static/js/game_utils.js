/******************************************************************************
 * Game utitilies. 
 * Functions defined on the Game object.
 * These should be of general use across games;
 * Functions unique to a game type will be loaded in a js file 
 * associated with that type in the /admin area of the host program.
 * All game util files should have the same format: $.extend(Game, ...)
 ******************************************************************************/

$.extend(Game, {
	
	everyNTimes: function (n, return_value, default_value) {
		if (Math.trunc(Math.random() * n) % n === 0) {
			return return_value;
		} else {
			return default_value;
		}
	}
});