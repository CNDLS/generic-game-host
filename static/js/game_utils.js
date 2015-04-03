/******************************************************************************
 * Game utitilies. 
 * Functions defined on the Game object.
 * These should be of general use across games;
 * Functions unique to a game type will be loaded in a js file 
 * associated with that type in the /admin area of the host program.
 * All game util files should have the same format: $.extend(Game, ...)
 ******************************************************************************/

$.extend(Game, {
	
	everyNthTime: function (n, return_value, default_value) {
		this.i = this.i || 0;
		this.i++;
		if (this.i === n) {
			this.i = 0;
			return return_value;
		} else {
			return default_value;
		}
	},
	
	aboutEveryNTimes: function (n, return_value, default_value) {
		if (Math.trunc(Math.random() * n) % n === 0) {
			return return_value;
		} else {
			return default_value;
		}
	},
	
	clearCards: function (selector) {
		// tell all dealers to clear their cards from the game.
		try {
			this.prompter.discardAll();
			this.listener.discardAll();
			this.responder.discardAll();
		} catch (e) {
			console.log(e);
		}
		// clear any remaining cards (probably orphaned).
		this.element.find(selector).find(".card").remove();
	}
});