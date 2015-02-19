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
	if (typeof card_or_spec !== "function"){
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


/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Prompter = function (round) {
	Util.extend_properties(this, new Game.Dealer(round));

	// deliver the prompt card(s) from the current Round spec.
	var prompts = round.read("Prompt");
	if (prompts.constructor !== Array){ prompts = [prompts]; }
	var _this = this;
	$.each(prompts, function (i, prompt) {
		_this.addCard(prompt);
	});
}
$.extend(Game.Prompter.prototype, Game.Dealer.prototype);


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
		Type: "MultipleChoice"
	}
	// get response types and insure it is an array.
	var response_types = round.read("ResponseTypes");
	if (typeof response_types === "string") {
		response_types = [response_types];
	}
	// assemble cards made by all the response types into my cards array.
	this.cards = $.map(response_types, function(response_type) {
		return Game.ListenerCardFactory.create([response_type || Game.Listener.DEFAULTS.Type], round);
	});
}
$.extend(Game.Listener.prototype, Game.Dealer.prototype);

Game.ListenerCard = {}
Game.ListenerCardFactory = {
	create: function (response_type, round) {
		var card_type = response_type + "Card";
		if (!Game.ListenerCard.hasOwnProperty(card_type)) {
			console.log("Warning: Cannot find Card type:" + card_type);
		} else {
			var listener_card = new Game.ListenerCard[card_type](round);
			listener_card.populate();
			return listener_card;
		}
	}
}


/* Each ListenerCard will capture input form the user(s).
 * Upon receiving user input, the card resolves the Listener's Deferred,
 * passing one of the Answer objects created from the YAML spec for this Round.
 */

/* FreeResponseCard just creates a card with a text input field and doesn't care about the answer. */
Game.ListenerCard.FreeResponseCard = function (round) {
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
		}
	});
	this.element.find("input[type=text]").focus();
	return true;
}

/* MultipleChoiceCard creates a card with a list of radio buttons, labelled with Answers from YAML. */
Game.ListenerCard.MultipleChoiceCard = function (round) {
	this.radio_btns = {};
	var group_name = "radio_group_" + round.nbr;
	var _this = this;
	$.each(round.answers, function (i, answer_spec) {
		var answer = new Game.Answer(answer_spec);
		var btn_id = "radio_btn_" + round.nbr + "_" + (i + 1);
		_this.radio_btns[btn_id] =
			{ html: ("<input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + btn_id + "\">" + answer.content + "</label></input>"),
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
		return Game.FeedbackCardFactory.create(feedback_type, answer, score);
	});
}
$.extend(Game.Responder.prototype, Game.Dealer.prototype);


Game.FeedbackCard = {}
Game.FeedbackCardFactory = {
	create: function (feedback_type) {
		var card_type = feedback_type + "Feedback";
		if (!Game.FeedbackCard.hasOwnProperty(card_type)) {
			console.log("Warning: Cannot find Card type:" + card_type);
		} else {
			var feedback_card = new Game.FeedbackCard[card_type]();
			feedback_card.populate();
			return feedback_card;
		}
	}
}

Game.FeedbackCard.SimpleFeedback = function () {
}