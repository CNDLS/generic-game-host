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
	
	withCard: function (queried_selector, test_selector, return_value, default_value) {
		// do these two different selectors resolve to the same set of elements in jQuery?
		// eg; is first child element yield an element that has some particular id/class combination?
		if ($(queried_selector).is(test_selector)) {
			return return_value;
		} else {
			return default_value;
		}
	},
	
	clearCards: function (selector, card_classnames) {
		// clear all selected cards.
		card_classnames = (card_classnames || "") + ".card";
		$(selector || "#game").find(card_classnames).each(function () {
			// fallback is to just remove the element.
			var card = $(this).data().card || $(this);
			// extra safeguard.
			(card.remove || $.noop).call(card);
		});
	},
	
	/*** Returns for ex; "Game.Round.Prompter" For reporting. ***/
	getClassName: function (obj, scope, scope_names) {
		if (obj === undefined) { return undefined; }
		scope = scope || Game;
		scope_names = scope_names || ["Game"];
		if (obj.constructor === scope) return scope_names.join(".");
		
		for (var m in scope) {
			var member = scope[m];
			if ( (typeof member === "function")
				 || ((typeof member === "object") && (typeof member["new"] === "function")) ) {
				if (obj.constructor === member) {
					scope_names.push(m);
					return scope_names.join(".");
				} else {
					var member_scope_names = scope_names.slice();
					member_scope_names.push(m);
					var found_obj = Game.getClassName(obj, member, member_scope_names);
					if (found_obj) { return found_obj; }
				}
			}
		}
	},
  
	getFunctionName: function (fn, scope, scope_names) {
		if (fn === undefined) { return undefined; }
		scope = scope || Game;
		scope_names = scope_names || ["Game"];
		if (fn === scope) return scope_names.join(".");
    
		for (var m in scope) {
			var member = scope[m];
			if (typeof member === "function") {
				if (fn === member) {
					scope_names.push(m);
					return scope_names.join(".");
				} else {
					var member_scope_names = scope_names.slice();
					member_scope_names.push(m);
					var found_fn = Game.getFunctionName(fn, member, member_scope_names);
					if (found_fn) { return found_fn; }
				}
			}
		}
  }
});