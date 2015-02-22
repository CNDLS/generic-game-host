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

Game.Dealer = function (context) {
	this.context = context; // game or round.
	this.cards = [];
	
	Game.Dealer.NO_DEAL = [];
}
// default action for dealing cards is just to put them onscreen,
// and then resolve the promise right away.
Game.Dealer.prototype.dealCards = function (successFn) {
	var deal_promises = $(this.cards).collect(function() {
		var card = this;
		var dfd = $.Deferred();
		// deal the card, passing the deferred object,
		// which it can take the responsibility for and then must
		// dfd.resolve() once the card is dealt.
		// if it takes on that responsibility, card.deal() returns true.
		// REMEMBER, at this point, the Card is just saying whether or not it has been dealt;
		// Cards that wait for user input once they've been dealt should do so via a different dfd.
		( card.deal(dfd) ) ? $.noop() : dfd.resolve();
		return dfd.promise();
	});
	
	// if no cards are dealt, get a promise from the InternalClock.
	if (deal_promises == Game.Dealer.NO_DEAL) {
		deal_promises.push(this.game.internal_clock.getPromise());
	}
	
	// weird construction lets us put our array of promises into params of $.when().
	$.when.apply($, deal_promises).then(successFn || $.noop);
}

Game.Dealer.prototype.addCard = function (card_or_spec) {
	var card = card_or_spec;
	if ( !(card_or_spec instanceof Game.Card) ){
		card = Game.Card.create(card_or_spec);
	}
	this.cards.push(card);
	return card;
}
// deal one specified card, regardless of what else might be in my 'deck'.
Game.Dealer.prototype.dealOneCard = function (card_or_spec, successFn) {
	var sv_cards = this.cards;
	this.cards = [];
	var card = this.addCard(card_or_spec);
	this.dealCards(successFn);
	this.cards = sv_cards;
	return card; // card contains the promise of being dealt.
}
// remove one or more cards from my 'deck'.
Game.Dealer.prototype.discard = function (array_or_card) {
	var array_of_cards = array_or_card;
	if (array_or_card.constructor !== Array) {
		array_of_cards = [array_or_card];
	}
	this.cards = $(this.cards).reject(function() {
		if (array_of_cards.indexOf(this) > -1) {
			// reject any pending dfd, so any cleanup can happen.
			in_production_try(this, this.dfd.reject);
			return true;
		}
		return false;
	});
}
// forget all my cards.
Game.Dealer.prototype.discardAll = function () {
	// reject any pending dfd's, so any cleanup can happen.
	$.each(this.cards, function () {
		in_production_try(this, this.dfd.reject);
	});
	this.cards = [];
}
// what I tell the Reporter about myself.
Game.Dealer.prototype.report = function () {
	return $(this.cards).collect(function() {
		var card = this;
		return card.report();
	}).join(",");
}


// card scopes by dealer.
Game.PromptCard = {};
Game.ListenerCard = {};
Game.ResponderCard = {};

// a factory for creating cards for the various dealers.
Game.CardFactory = {
	create: function (/* dealer_card_scope_name, card_type, round, ... */) {
	    if (arguments.length === 0) return;
	    var args = Array.prototype.slice.call(arguments);
		var dealer_card_scope_name = args.shift();
		var dealer_card_scope = Game[dealer_card_scope_name];
		var card_type = args.shift();
		return in_production_try(this, function () {
			if (typeof card_type !== "string") {
				throw new Error("Invalid Card Type.");
			}
			if (!dealer_card_scope.hasOwnProperty(card_type)) {
				console.error("Cannot find Card type: " + dealer_card_scope_name + "[" + card_type + "]");
			} else {
				var card = new dealer_card_scope[card_type](args);
				// add css classes for dealer_card_scope & card_type.
				var css_classes = [
					// PromptCard becomes prompt css class.
					dealer_card_scope_name.replace("Card", "").underscore(), // eg; SomeDealerCard -> some_dealer
					card_type.underscore() // eg; MultipleChoiceCard -> multiple_choice_card
				].join(" ");
				card.populate(css_classes);
				return card;
			}
		});
	}
}


/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Prompter = function (round) {
	Util.extend_properties(this, new Game.Dealer(round));
	
	Game.Prompter.DEFAULTS = {
		Type: "Simple" // just a text/html message in a Card.
	}

	// deliver the prompt card(s) from the current Round spec.
	var prompts = round.read("Prompt");
	if ( !(prompts instanceof Array) ){ prompts = [prompts]; }
	this.cards = $.map(prompts, function(prompt) {
		var prompt_card_type = prompt.prompt_type || Game.Prompter.DEFAULTS.Type;
		return Game.CardFactory.create("PromptCard", prompt_card_type, prompt);
	});
	
	// var _this = this;
	// $.each(prompts, function (i, prompt) {
	// 	_this.addCard(prompt);
	// });
}
$.extend(Game.Prompter.prototype, Game.Dealer.prototype);


Game.PromptCard.Simple = function (args) {
	var spec = args.shift();
	Util.extend_properties(this, new Game.Card(spec));
}
$.extend(Game.PromptCard.Simple.prototype, Game.Card.prototype);


/* 
 * Listener
 * Each response_type creates a different drives the loading of some kind of widget. Lots of customization will probably happen here,
 * so expect this to get refactored over time.
 * Basic response widget types are: MultipleChoice (radio buttons), MultipleAnswer (check boxes), and FreeResponse (text field).
 * Other types can be defined in a game_utils.js file for a particular instance. 
 */
Game.Listener = function(round) {
	Util.extend_properties(this, new Game.Dealer(round));
	
	Game.Listener.DEFAULTS = {
		Type: "MultipleChoiceCard"
	}
	// get response types and insure it is an array.
	var response_types = round.read("ResponseTypes");
	if (typeof response_types === "string") {
		response_types = [response_types];
	}
	// assemble cards made by all the response types into my cards array.
	this.cards = $.map(response_types, function(response_type) {
		var listener_card_type = response_type || Game.Listener.DEFAULTS.Type;
		return Game.CardFactory.create("ListenerCard", listener_card_type, round);
	});
}
$.extend(Game.Listener.prototype, Game.Dealer.prototype);


/* Each ListenerCard will capture input form the user(s).
 * Upon receiving user input, the card resolves the Listener's Deferred,
 * passing one of the Answer objects created from the YAML spec for this Round.
 */

/* FreeResponseCard just creates a card with a text input field and doesn't care about the answer. */
Game.ListenerCard.FreeResponseCard = function (args) {
	var round = args.shift();
	Util.extend_properties(this, new Game.Card("<input type=\"text\" />"));
}
$.extend(Game.ListenerCard.FreeResponseCard.prototype, Game.Card.prototype);

Game.ListenerCard.FreeResponseCard.prototype.deal = function (dfd) {
	Game.Card.prototype.deal.call(this, dfd);
	var _this = this;
	this.element.find("input[type=text]").on("keypress", function(e) {
        if (e.keyCode === 13) {
			var answer = new Game.Answer(e.target.value);
			var score = 1; // any response is accepted.
			_this.dfd.resolve(answer, score);
			e.target.blur();
		}
	});
	this.element.find("input[type=text]").focus();
	return true;
}

/* MultipleChoiceCard creates a card with a list of radio buttons, labelled with Answers from YAML. */
Game.ListenerCard.MultipleChoiceCard = function (args) {
	var round = args.shift();
	this.radio_btns = {};
	var group_name = "radio_group_" + round.nbr;
	var _this = this;
	$.each(round.answers, function (i, answer_spec) {
		var answer = new Game.Answer(answer_spec);
		var btn_id = "radio_btn_" + round.nbr + "_" + (i + 1);
		_this.radio_btns[btn_id] =
			{ html: ("<li><input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + btn_id + "\">" + answer.content + "</label></input></li>"),
			  answer: answer
			}
	});
	var radio_btn_html = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
		return btn.html;
	}).join("\n");
	Util.extend_properties(this, new Game.Card(radio_btn_html));
}
$.extend(Game.ListenerCard.MultipleChoiceCard.prototype, Game.Card.prototype);

Game.ListenerCard.MultipleChoiceCard.prototype.deal = function (dfd) {
	Game.Card.prototype.deal.call(this, dfd);
	var _this = this;
	this.element.find("input[type=radio]").on("click", function(e) {
		var clicked_radio_btn = _this.radio_btns[e.target.id];
		var correct = clicked_radio_btn.answer.correct || false;
		var value = clicked_radio_btn.answer.value || 1;
		var neg_value = clicked_radio_btn.answer.negative_value || 0; // any penalty for answering incorrectly?
		var answer = new Game.Answer(clicked_radio_btn.answer);
		var score = correct ? value : neg_value;
		_this.dfd.resolve(answer, score);
	});
	return true;
}


/* 
 * Answers are how the user's actions are communicated to the program. 
 * They need to have a getContents() function, which describes what the user input.
 * Answers don't need to provide any other functionality, but are there in case
 * a ListenerCard wants to do something special with them --
 * since ListenerCards cause Answers to be created, they can create their
 * own types.
 * Answers originate in the YAML spec, and they can specify feedback.
 */
Game.Answer = function (spec) {
	if (typeof spec === "string") {
		spec = { content: spec };
	}
	$.extend(this, spec);
}

Game.Answer.prototype.getContents = function () {
	return this.content;
}


/* 
 * Responder
 * The Responder deals card(s) which give feedback to the user, based on their answer & its score.
 */
Game.Responder = function (round, answer, score) {
	Util.extend_properties(this, new Game.Dealer(round));
	
	Game.Responder.DEFAULTS = {
		FeedbackType: "Simple" // just a text/html message in a Card.
	}
	
	// get answer's feedback, if any.
	var feedback = answer.feedback || [];
	if (typeof feedback === "string") {
		feedback = [{
			content: feedback
		}];
	}
	// assemble cards made by all the feedback into my cards array.
	// careful, as 'feedback' is a mass noun: they are feedback; it is feedback.
	this.cards = $.map(feedback, function(feedback) {
		var feedback_type = feedback.type || Game.Responder.DEFAULTS.FeedbackType
		return Game.CardFactory.create("ResponderCard", feedback_type, round, answer, score);
	});
}
$.extend(Game.Responder.prototype, Game.Dealer.prototype);


Game.ResponderCard.Simple = function (args) {
	var round = args.shift();
	var answer = args.shift();
	var score = args.shift();
	if (answer.feedback) {
		Util.extend_properties(this, new Game.Card(answer.feedback));
	}
}
$.extend(Game.ResponderCard.Simple.prototype, Game.Card.prototype);
