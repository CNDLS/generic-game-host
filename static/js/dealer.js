/* 
 * Each state in a Game Round is governed by a Dealer.
 * The managers are: Prompter, Listener, and Responder.
 * Each operates by creating Cards, dealing them, and 
 * co-ordinating between them to decide when to move on to the next state.
 * start() instantiates a Prompter,
 * wait() instantiates a Listener,
 * evaluate() instantiates a Listener.
 * Dealer created earlier persist throughout the Round.
 * They all borrow functionality from the Dealer prototype.
 */

Game.Dealer = function (game_or_round, container) {
	// keep references to game and round, if applicable.
	if (game_or_round instanceof Game) {
			this.round = null;
			this.game = game_or_round;
  } else if (game_or_round instanceof Game.Round) {
			this.round = game_or_round;
			this.game = game_or_round.game;
	}

	this.container = container;
	this.cards = [];
	this.deal_promises = [];
	
	Game.Dealer.NO_DEAL = [];
}


Game.Dealer.prototype = $.extend(Game.Dealer.prototype, {
  init: function () {
  	// stub.
  },
  
  // this function examines all the cards to be dealt, and waits until they are all loaded before executing dealCards().
  // it passes back the promise from dealCards to the original caller.
  deal: function (cards_to_be_dealt, container, dealing_dfd) {
  	cards_to_be_dealt = cards_to_be_dealt || this.cards;
  	if (!(cards_to_be_dealt instanceof Array)) {
  		cards_to_be_dealt = [cards_to_be_dealt];
  	}
  	var _this = this;
  	var card_load_promises = $(cards_to_be_dealt).collect(function (i) {
  		if (_this.cards.indexOf(this) > -1) {
  			try {
  				return this.load_promise;
  			} catch (e) {}
  		}
  	});
	
  	// filter out any null references in the array.
    for (var i = 0; i < card_load_promises.length; i++) {
      if (card_load_promises[i] == undefined) {         
        card_load_promises.splice(i, 1);
        i--;
      }
    }
	
  	// once all cards are ready, send the dealCards command.
  	var dfd = $.Deferred();
  	$.when.apply($, card_load_promises).then(function () {
  		_this.dealCards(cards_to_be_dealt, container, dealing_dfd).then(function () {
  			dfd.resolve();
  		});	
  	});
  	return dfd.promise();
  },

  // default action for dealing cards is just to put them onscreen,
  // and then resolve the promise right away.
  dealCards: function (cards_to_be_dealt, container, dealing_dfd) {
  	// we hold the deal_promises on the dealer object,
  	// so other entities (eg; those that add animations)
  	// can add promises of their own, which they resolve when they are ready,
  	// allowing us to then move on.
  	dealing_dfd = dealing_dfd || $.Deferred();
	
  	var _this = this;
  	var deal_promises = $(cards_to_be_dealt).collect(function (i) {
  		var card = this;
  		// deal the card, passing the deferred object,
  		// which it can take the responsibility for and then must
  		// dfd.resolve() once the card is dealt.
  		// if it takes on that responsibility, card.dealTo() returns true.
  		// REMEMBER, at this point, the Card is just saying whether or not it has been dealt;
  		// Cards that wait for user input once they've been dealt should do so via a different dfd.
  		( card.dealTo(container) ) ? $.noop() : dealing_dfd.resolve();
		
  		// in verbose mode, note in card's history that it was dealt and to where.
  		if (environment.verbose) {
  			card.history.push({ event: "dealt", to: Util.createDescriptor((card.container || $()).get(0)) });
  		}
		
  		return dealing_dfd.promise();
  	});
	
  	// strip out duplicates.
  	deal_promises = Array.getUnique(deal_promises);
	
  	// $.when.apply() lets us put our array of promises into params of $.when().
  	return $.when.apply($, this.deal_promises);
  },

  addCard: function (card_or_spec) {
  	var card = card_or_spec;
  	if ( !(card_or_spec instanceof Game.Card) ){
  		card = Game.Card.create(card_or_spec);
  	}
  	this.cards.push(card);
  	return card;
  },

  addPromise: function (dfd_promise, new_successFn) {
  	if (this.master_promise && this.master_promise.state() === "resolved") {
  		return;
  	}
  	this.deal_promises.push(dfd_promise);
  	// have to re-do when()...?
  	var _this = this;
  	if (new_successFn) {
  		this.master_promise = $.when.apply($, this.deal_promises).then(new_successFn);
  	}
  },

  activateCards: function () {
  	$.each(this.cards, function () {
  		this.setActive(true);
  	});
  },

  deactivateCards: function () {
  	$.each(this.cards, function () {
  		this.setActive(false);
  	});
  },

  /* 
   * Some ways of waiting for the user to interact with Cards.
   */
  waitForUserInput: function () {
  	switch (this.accept_user_input) {
  		case "any":
  			return this.waitForAnyUserInput();
  			break;
			
  		case "each":
  			return this.waitForEachUserInput();
  			break;
			
  		case "all":
  			return this.waitForAllUserInput();
  			break;
			
  		case "collect":
  			return this.collectUserInput();
  			break;
			
  		case "none":
  			return this.game.internal_clock.nextTick();
  			break;
			
  		default:
  			console.warn("Unknown 'accept user input' option:" + this.accept_user_input);
  			return this.game.internal_clock.nextTick();
  			break;
  	}
  },

  waitForAnyUserInput: function () {
  	this.user_input_dfd = $.Deferred();
  	// react to first user action.
  	var _this = this;
  	$(this.cards).each(function () {
  		this.element.on("Card.userInput", function (evt, data) {
  			// make any listener cards still onscreen unreceptive to user input (show them disabled).
  			// this is the default behavior; a listener would have to override if inputs should stay active
  			// past this point.
  			_this.deactivateCards(data.card);
  			_this.user_input_dfd.resolve(data);
  		});
  	});
  	return this.user_input_dfd.promise();
  },

  // this refers to presenting one card at-a-time to the user,
  // and advancing through each one upon some interaction from the user.
  // NOTEs: 
  // - deals each of the cards upon resolution of prior card's interaction promise.
  // - consumes this.cards, so the list will be empty. any cards added after are not dealt by this.
  waitForEachUserInput: function () {
  	var dealer = this;
  	var p = dealer.game.internal_clock.nextTick();
  	$(this.cards).each(function (i) {
  		var card = this;
  		if (i > 0) {
  			var prior_card = dealer.cards[i-1];
  			p = prior_card.user_input_dfd.promise()
  		}
  		p.then(function () {
  			return dealer.deal(card);
  		})
  	});
	
  	if (this.cards.length) {
  		// return the promise that will get fulfilled when the user interacts with the last Card.
  		var last_card = this.cards[this.cards.length-1];
      this.user_input_dfd = last_card.user_input_dfd;
  		return last_card.user_input_dfd.promise();
  	} else {
  		// return a generic promise.
  		return dealer.game.internal_clock.nextTick();
  	}
  },

  waitForAllUserInput: function () {
  	this.user_input_dfd = $.Deferred();
  	// react only after user acts on all available cards.
  	var _this = this;
  	var collected_data = [];
  	$(this.cards).each(function () {
  		this.element.on("Card.userInput", function (evt, data) {
  			// make this listener card unreceptive to user input (show it disabled).
  			this.setActive(false);
  			// collect all answers and scores
  			collected_data.push(data);
  			if (collected_data.length === card_elements.length) {
  				_this.user_input_dfd.resolve(collected_data);
  			}
  		});
  	});
  	return this.user_input_dfd.promise();
  },

  // ONLY USE THIS WHERE ANOTHER MECHANISM PROVIDES A PROMISE
  // FROM this.user_input_dfd (eg; a submit button. cf GroupedInputsListener)
  collectUserInput: function () {
  	var collected_data = [];
  	$(this.cards).each(function () {
  		var _this = this;
  		this.element.on("Card.userInput", function (evt, data) {
  			// make this listener card unreceptive to user input (show it disabled).
  			// _this.setActive(false);
  			// collect all answers and scores
  			collected_data.push(data);
  		});
  	});
  	this.collected_data = collected_data;
	
  	this.user_input_dfd = this.user_input_dfd || $.Deferred();
  	return this.user_input_dfd.promise();
  },

  // remove one or more cards from my 'deck'.
  discard: function (array_or_card) {
  	var array_of_cards = array_or_card;
  	if (array_or_card.constructor !== Array) {
  		array_of_cards = [array_or_card];
  	}
  	this.cards = $(this.cards).reject(function () {
  		if (array_of_cards.indexOf(this) > -1) {
  			this.remove();
  			return true;
  		}
  		return false;
  	});
  },

  // forget all my cards.
  discardAll: function () {
  	$.each(this.cards, function () {
  		this.element.remove();
  	});
  	this.cards = [];
  },

  // what I tell the Reporter about myself.
  report: function () {
  	if (environment.verbose || false) {
  		// get each cards constructor, its element element descriptor,
  		// and some info about its current state.
  		var cards_report = $(this.cards).collect(function () {
  			var card = this;
  			return { card: Game.getClassName(card), descriptor: card.getDescriptor(), history: card.getHistory() };
  		});
	
  		return { dealer: Game.getClassName(this), cards: cards_report };
  	} else {
  		return Game.getClassName(this);
  	}
  }
});



// card scopes by dealer.
Game.PromptCard = function () {};
Game.ListenerCard = function () {};
Game.ResponderCard = function () {};


// a factory for creating cards for the various dealers.
Game.DealersCardFactory = {
	create: function (/* dealer_card_scope_name, card_type, dealer, ... */) {
		if (arguments.length === 0) return;
		var args = Array.prototype.slice.call(arguments);
		var dealer_card_scope_name = args.shift();
		var dealer_card_scope = Game[dealer_card_scope_name];
		var card_type = args.shift();
		var dealer = args.shift();
		return in_production_try(this, function createDealerCard () {
			if (typeof card_type !== "string") {
				throw new Error("Invalid Card Type.");
			}
			if (!dealer_card_scope.hasOwnProperty(card_type)) {
				console.error("Cannot find Card type: " + dealer_card_scope_name + "[" + card_type + "]");
			} else {
				var card;
				try {
					card = new dealer_card_scope[card_type](args);
				} catch (e) {
					card = new Game.Card(e); // report the error through the game UI.
				}
				// add css classes for dealer_card_scope & card_type.
				var css_classes = [
					"card",
					dealer_card_scope_name.replace("Card", "").underscore(), // eg; SomeDealerCard -> some_dealer
					card_type.underscore() // eg; MultipleChoiceCard -> multiple_choice_card
				].join(" ");
				card.style(css_classes);
				card.dealer = dealer;
				return card;
			}
		});
	}
}


/* 
 * ROUND DEALERS are: PROMPTER, LISTENER, RESPONDER.
 * Each has its own dealer js file and card-types js file.
 */