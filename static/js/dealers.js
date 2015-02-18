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
 * Listeners
 * each response_type creates a different drives the loading of some kind of widget. Lots of customization will probably happen here,
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
		return Game.ListenerCardFactory.create([response_type || Game.Listener.DEFAULTS.Type]);
	});
}
$.extend(Game.Listener.prototype, Game.Dealer.prototype);


Game.ListenerCardFactory = {
	create: function (response_type) {
		var card_type = response_type + "Card";
		if (!Game.Card.hasOwnProperty(card_type)) {
			console.log("Warning: Cannot find Card type:" + card_type);
		} else {
			var listener_card = new Game.Card[card_type]();
			listener_card.populate();
			return listener_card;
		}
	}
}

/* Each ListenerCardFactory type should create one or more Cards,
 * which will be used for capturing input form the user(s).
 * Upon receiving user input, the card(s) notify the Listener that dealt them.
 * The Listener should then notify the Round with one of the Answer objects 
 * created from the YAML spec for this Round.
 */
Game.ListenerCardFactory.MultipleChoice = {
	 makeCards: function() {
		// create a single Card containing a form with radio buttons
		var radio_btns = {};
		var group_name = "radio_group_" + this.round.nbr;
		$.each(this.answers, function (i, answer_spec) {
			var answer = new Answer(answer_spec);
			var btn_id = "radio_btn_" + widget.round.nbr + "_" + (i + 1);
			widget.radio_btns[btn_id] = 
				{ html: ("<input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
							+ "<label for=\"" + btn_id + "\">" + answer.content + "</label></input>"),
				  answer: answer
				}
		});
		var content = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
			return btn.html;
		}).join("\n");
		var card = Game.Card.create(content);
		var default_deal = card.deal;
		card.deal = function () {
			card.element.find("input[type=radio]").on("click", function(e) {
				var clicked_radio_btn = widget.radio_btns[e.target.id];
				var correct = clicked_radio_btn.answer.correct || false;
				var value = clicked_radio_btn.answer.value || 1;
				var neg_value = clicked_radio_btn.answer.negative_value || 0; // any penalty for answering incorrectly?
				widget.score += correct ? value : neg_value;
				var answer = new Answer(clicked_radio_btn.answer);
				widget.responder.respond(answer);
			});
			default_deal.apply(card);
		}
		return card;
	}
}

Game.Card.FreeResponseCard = function () {
	// create a card from a self-defined spec.
	var spec = {
		content: { "form": "<input type=\"text\" />" }
	}
	Util.extend_properties(this, new Game.Card(spec));
}
$.extend(Game.Card.FreeResponseCard.prototype, Game.Card.prototype);

Game.Card.FreeResponseCard.prototype.deal = function (dfd) {
	Game.Card.prototype.deal.call(this, dfd);
	var _this = this;
	this.element.find("input[type=text]").on("keypress", function(e) {
        if (e.keyCode === 13) {
			var answer = new Answer(e.target.value);
			_this.dfd.resolve(answer);
		}
	});
	this.element.find("input[type=text]").focus();
	return true;
}


/* 
 * Answer
 * Answers are how the user's actions are communicated to the program. 
 * Answers should provide ??
 */
function Answer(spec) {
	if (typeof spec === "string") {
		spec = { content: spec };
	}
	$.extend(this, spec);
}



/* 
 * Responder
 * Default Responder is just to deal a card with some text or HTML on it,
 * which represents feedback generate by Listener, when it compares the Prompt & Answer objects.
 *** NEEDS REFACTORING *** 2/17 bg.
 */
function Responder(feedback_types, responder, answer) {
	// Responder.DEFAULTS = {
	// 	Type: "Simple"
	// }
	// this.responder = responder;
	// this.answer = answer;
	// var _this = this;
	// this.widgets = $.map(feedback_types, function(feedback_type) {
	// 	return ResponderWidgetFactory.create([feedback_type || Responder.DEFAULTS.Type], _this);
	// });
}
// Responder.prototype.give = function () {
// 	// all widgets get the giveResponder() command simulatenously, but a widget's giveResponder()
// 	// might just enable it or put it into 'play' in some way (like an additional reward, barrier, or character).
// 	var _this = this;
// 	var rtn_val = false;
// 	$.each(this.widgets, function (i, widget) {
// 		rtn_val = rtn_val || widget.giveResponder(_this.answer);
// 	});
// 	return rtn_val;
// }

ResponderWidgetFactory = {};

// ResponderWidgetFactory.create = function (feedback_type, feedback_obj) {
// 	if (!ResponderWidgetFactory.hasOwnProperty(feedback_type)) {
// 		console.log("Warning: Cannot find ResponderWidgetFactory." + feedback_type);
// 		return;
// 	}
// 	// as with ListenerWidgets, we use Cards to convey messages.
// 	// again, someday these could come from synchronous communication between users.
// 	var widget;
// 	in_production_try(this,
// 		function () {
// 			// create widget and attach my feedback_obj. ask widget to create a Card.
// 			widget = new ResponderWidgetFactory[feedback_type](feedback_obj);
// 			// ensure that responder gets set.
// 			if (!widget.hasOwnProperty("feedback_obj")) {
// 				widget["feedback_obj"] = feedback_obj;
// 			}
// 		}
// 	);
// 	return widget;
// }
//
// ResponderWidgetFactory.Simple = function () {}
// ResponderWidgetFactory.Simple.prototype.giveResponder = function(answer) {
// 	var feedback_card = this.getCard(answer.feedback)
// 	feedback_card.deal();
// 	return feedback_card;
// }
// ResponderWidgetFactory.Simple.prototype.getCard = function(feedback_spec) {
// 	if (typeof feedback_spec === "string") {
// 		feedback_spec = { content: { "div": feedback_spec } };
// 	}
// 	var card_spec = {
// 		content: feedback_spec.content
// 	}
// 	var card = Game.Card.create(card_spec);
// 	return card;
// }