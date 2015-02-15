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
	var _this = this;
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
function Listener(response_types, round) {
	Listener.DEFAULTS = {
		Type: "MultipleChoice"
	}
	this.round = round;
	var responder = this;
	this.widgets = $.map(response_types, function(response_type) {
		return ListenerWidgetFactory.create([response_type || Listener.DEFAULTS.Type], responder);
	});
}
Listener.prototype.deal = function () {
	$.each(this.widgets, function (index, widget) {
		if ( widget.hasOwnProperty("card") 
			&& (widget.card.hasOwnProperty("deal"))
			&& (typeof widget.card.deal === "function") ) {
			widget.card.deal();
		}
	});
}
Listener.prototype.respond = function (answer) {
	var feedback_spec = answer["feedback"] || [];
	if (typeof feedback_spec === "string") {
		feedback_spec = [{ content: feedback_spec }];
	} else if (feedback_spec.constructor !== Array) {
		feedback_spec = [feedback_spec];
	}
	var feedback_types = $.map(feedback_spec, function () {
		return this["feedback_type"] || Responder.DEFAULTS.Type;
	});
	var feedback = new Responder(feedback_types, this, answer);
	// move on immediately to the state of evaluating responses. 
	// don't defer(), as one of multiple widgets could've triggered this, and we need to get out of this state, pronto.
	this.round.respond(feedback);
}
Listener.prototype.evaluateListener = function () {
	/*** what to do about being partially correct? or correct-ness that is cumulative across widgets? ***/
	var rtn_val = 0;
	$.each(this.widgets, function (index, widget) {
		if (typeof widget.getScore === "function"){ rtn_val += widget.getScore(); }
	});
	return rtn_val;
}

function ListenerWidgetFactory() {}

ListenerWidgetFactory.create = function (response_type, responder) {
	if (!ListenerWidgetFactory.hasOwnProperty(response_type)) {
		console.log("Warning: Cannot find ListenerWidgetFactory." + response_type);
		return;
	}
	// we're going to always use Cards as our way of making 'moves' in a game,
	// whether initiated by the game or, eventually, by users.
	// Then, when we get to synchronous peer-to-peer games,
	// we'll have a standard way of presenting 'moves' sent by peers.
	// Also, cleaning up after Rounds should always just be a matter of removing Cards
	// that are no longer relevant.
	var widget;
	in_production_try(this,
		function () {
			// create widget and attach my responder. ask widget to create a Card.
			widget = new ListenerWidgetFactory[response_type](responder);
			// ensure that responder gets set.
			if (!widget.hasOwnProperty("responder")) {
				widget["responder"] = responder; 
			}
			// ensure that answers get set.
			try {
				widget.answers = responder.round.answers;
			} catch (e) {
				widget.answers = [];
			}
			widget.card = widget.getCard();
		}
	);
	return widget;
}

/* Each response widget type should provide a getContents() function that accepts no arguments,
 * and that returns a spec for creating a Card.
 * Each response widget should return an Answer object. This comes from the YAML spec for this Round.
 */
ListenerWidgetFactory.MultipleChoice = function (responder) {
	this.round = responder.round;
	this.score = 0;
}
ListenerWidgetFactory.MultipleChoice.prototype.getCard = function() {
	// set up a Card with a form with radio buttons
	var widget = this;
	this.radio_btns = {};
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
ListenerWidgetFactory.MultipleChoice.prototype.getScore = function() {
	// points associated with the clicked radio button, if its response marked "correct:true" in the YAML.
	return this.score;
}

// ListenerWidgetFactory.MultipleAnswer = function () {}
// ListenerWidgetFactory.MultipleAnswer.prototype.getCard = function() {
	/* set up a Card with a form with check boxes */
// }

ListenerWidgetFactory.FreeResponse = function () {}
ListenerWidgetFactory.FreeResponse.prototype.getCard = function() {
	var card_spec = {
		content: { "form": "<input type=\"text\" />" }
	}
	var card = Game.Card.create(card_spec);
	var default_deal = card.deal;
	var widget = this;
	card.deal = function () {
		card.element.find("input[type=text]").on("keypress", function(e) {
	        if (e.keyCode === 13) {
				var answer = new Answer(e.target.value);
				widget.responder.respond(answer);
			}
		});
		default_deal.apply(card);
		card.element.find("input[type=text]").focus();
	}
	return card;
}
ListenerWidgetFactory.FreeResponse.prototype.getScore = function() {
	// any response is fine by default in FreeResponse (eg; getting user's name).
	/*** need to create a ScoredTextListener, with correctness function passed via YAML. ***/
	return 1;
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
 * Default Responder is just to deal a card with some text or HTML on it.
 * Similar method for getting Listeners from the user: option for multiple widgets.
 * Should really focus on allowing many feeback types & also allowing logic for custom feedback.
 * Responder objects just need a constructor and a give() method.
 */
function Responder(feedback_types, responder, answer) {
	Responder.DEFAULTS = {
		Type: "Simple"
	}
	this.responder = responder;
	this.answer = answer;
	var _this = this;
	this.widgets = $.map(feedback_types, function(feedback_type) {
		return ResponderWidgetFactory.create([feedback_type || Responder.DEFAULTS.Type], _this);
	});
}
Responder.prototype.give = function () {
	// all widgets get the giveResponder() command simulatenously, but a widget's giveResponder()
	// might just enable it or put it into 'play' in some way (like an additional reward, barrier, or character).
	var _this = this;
	var rtn_val = false;
	$.each(this.widgets, function (i, widget) {
		rtn_val = rtn_val || widget.giveResponder(_this.answer);
	});
	return rtn_val;
}

ResponderWidgetFactory = {};

ResponderWidgetFactory.create = function (feedback_type, feedback_obj) {
	if (!ResponderWidgetFactory.hasOwnProperty(feedback_type)) {
		console.log("Warning: Cannot find ResponderWidgetFactory." + feedback_type);
		return;
	}
	// as with ListenerWidgets, we use Cards to convey messages.
	// again, someday these could come from synchronous communication between users.
	var widget;
	in_production_try(this,
		function () {
			// create widget and attach my feedback_obj. ask widget to create a Card.
			widget = new ResponderWidgetFactory[feedback_type](feedback_obj);
			// ensure that responder gets set.
			if (!widget.hasOwnProperty("feedback_obj")) {
				widget["feedback_obj"] = feedback_obj; 
			}
		}
	);
	return widget;
}

ResponderWidgetFactory.Simple = function () {}
ResponderWidgetFactory.Simple.prototype.giveResponder = function(answer) {
	var feedback_card = this.getCard(answer.feedback)
	feedback_card.deal();
	return feedback_card;
}
ResponderWidgetFactory.Simple.prototype.getCard = function(feedback_spec) {
	if (typeof feedback_spec === "string") {
		feedback_spec = { content: { "div": feedback_spec } };
	}
	var card_spec = {
		content: feedback_spec.content
	}
	var card = Game.Card.create(card_spec);
	return card;
}