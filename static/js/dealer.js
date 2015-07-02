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
	this.context = game_or_round;
	this.container = container || game_or_round.container;
	this.cards = [];
	this.deal_promises = [];
	
	Game.Dealer.NO_DEAL = [];
}

Game.Dealer.prototype.init = function () {
	// stub.
}

// this function examines all the cards to be dealt, and waits until they are all loaded before executing dealCards().
// it passes back the promise from dealCards to the original caller.
Game.Dealer.prototype.deal = function (cards_to_be_dealt, container) {
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
	
  for (var i = 0; i < card_load_promises.length; i++) {
    if (card_load_promises[i] == undefined) {         
      card_load_promises.splice(i, 1);
      i--;
    }
  }
	
	// once all cards are ready, send the dealCards command.
	var dfd = $.Deferred();
	$.when.apply($, card_load_promises).then(function () {
		_this.dealCards(cards_to_be_dealt, container).then(function () {
			dfd.resolve();
		});	
	});
	return dfd.promise();
}
	
// default action for dealing cards is just to put them onscreen,
// and then resolve the promise right away.
Game.Dealer.prototype.dealCards = function (cards_to_be_dealt, container, dfd) {
	// we hold the deal_promises on the dealer object,
	// so other entities (eg; those that add animations)
	// can add promises of their own, which they resolve when they are ready,
	// allowing us to then move on.
	var _this = this;
	var deal_promises = $(cards_to_be_dealt).collect(function (i) {
		var card = this;
		dfd = dfd || $.Deferred();
		// deal the card, passing the deferred object,
		// which it can take the responsibility for and then must
		// dfd.resolve() once the card is dealt.
		// if it takes on that responsibility, card.dealTo() returns true.
		// REMEMBER, at this point, the Card is just saying whether or not it has been dealt;
		// Cards that wait for user input once they've been dealt should do so via a different dfd.
		( card.dealTo(container, dfd) ) ? $.noop() : dfd.resolve();
		return dfd.promise();
	}).getUnique();
	
	// if no cards are dealt, get a promise from the InternalClock.
	if (this.deal_promises == Game.Dealer.NO_DEAL) {
		this.deal_promises.push(this.game.internal_clock.getPromise());
	}
	
	// weird construction lets us put our array of promises into params of $.when().
	this.master_promise = $.when.apply($, this.deal_promises);
	return this.master_promise;
}

Game.Dealer.prototype.addCard = function (card_or_spec) {
	var card = card_or_spec;
	if ( !(card_or_spec instanceof Game.Card) ){
		card = Game.Card.create(card_or_spec);
	}
	this.cards.push(card);
	return card;
}

Game.Dealer.prototype.addPromise = function (dfd_promise, new_successFn) {
	if (this.master_promise && this.master_promise.state() === "resolved") {
		return;
	}
	this.deal_promises.push(dfd_promise);
	// have to re-do when()...?
	var _this = this;
	if (new_successFn) {
		this.master_promise = $.when.apply($, this.deal_promises).then(new_successFn);
	}
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
	this.cards = $(this.cards).reject(function () {
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
	return $(this.cards).collect(function () {
		var card = this;
		return card.report();
	}).join(",");
}


// card scopes by dealer.
Game.PromptCard = {};
Game.ListenerCard = {};
Game.ResponderCard = {};

// a factory for creating cards for the various dealers.
Game.DealersCardFactory = {
	create: function (/* dealer_card_scope_name, card_type, dealer, ... */) {
		if (arguments.length === 0) return;
		var args = Array.prototype.slice.call(arguments);
		var dealer_card_scope_name = args.shift();
		var dealer_card_scope = Game[dealer_card_scope_name];
		var card_type = args.shift();
		var dealer = args.shift();
		return in_production_try(this, function () {
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
					// PromptCard becomes prompt css class.
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
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Round.Prompter = function (round, spec) {
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Prompter.DEFAULTS = {
		Type: "Simple" // just a text/html message in a Card.
	}

	// deliver the prompt card(s) from the current Round spec.
	var _this = this;
	var prompts = round.read("Prompt");
	if ( !(prompts instanceof Array) ){ prompts = [prompts]; }
	this.cards = $.map(prompts, function (prompt) {
		var prompt_card_type = prompt.prompt_type || Game.Round.Prompter.DEFAULTS.Type;
		return Game.DealersCardFactory.create("PromptCard", prompt_card_type, _this, prompt);
	});
}
Util.extend(Game.Round.Prompter, Game.Dealer);


Game.PromptCard.Simple = function (args) {
	var spec = args.shift();
	Util.extend_properties(this, new Game.Card(spec));
}
Util.extend(Game.PromptCard.Simple, Game.Card);


/* 
 * Listener
 * Each response_type creates a different drives the loading of some kind of widget. Lots of customization will probably happen here,
 * so expect this to get refactored over time.
 * Basic response widget types are: MultipleChoice (radio buttons), MultipleAnswer (check boxes), and FreeResponse (text field).
 * Other types can be defined in a game_utils.js file for a particular instance. 
 */
Game.Round.Listener = function (round, spec, response_types) {
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Listener.DEFAULTS = {
		Type: "MultipleChoiceCard"
	}
	// get response types and insure it is an array.
	response_types = response_types || [];
	response_types = round.read("ResponseTypes", response_types);
	if (typeof response_types === "string") {
		response_types = [response_types];
	}
	// assemble cards made by all the response types into my cards array.
	var _this = this;
	this.cards = $.map(response_types, function (response_type) {
		var listener_card_type = response_type || Game.Round.Listener.DEFAULTS.Type;
		return Game.DealersCardFactory.create("ListenerCard", listener_card_type, _this, round);
	});
}
Util.extend(Game.Round.Listener, Game.Dealer);

Game.Round.Listener.prototype.deactivateCards = function () {
	$.each(this.cards, function () {
		$(this.element).find("input").prop( "disabled", true );
	});
}

/*
 * PromptLinkListener -- listens for clicks on links embedded in the Prompt card(s).
 */
Game.Round.PromptLinkListener = function (round, spec) {
	Util.extend_properties(this, new Game.Round.Listener(round, spec));
	// I don't need a ResponseType -- by default, I just scan
	// the Prompt for links, and call those my cards. I attach a click
	// listener to each to set up promises.
	// Of course, this all relies on the Prompt still being available onscreen.
	// What to do about mis-matches between nbr of links in the Prompt 
	// and nbr of answers listed in the spec?
	var _this = this;
	var prompt_links = [];
	$(round.prompter.cards).each(function () {
		$.merge(prompt_links, this.find("a"));
	});
	$.each(round.answers, function (i, answer_spec) {
		var link_id = "prompt_" + round.nbr + "_" + (i + 1) + "_" + S4(); // random 4-character code.
		try {
			var card_elem = prompt_links[i];
			var link_card = Game.DealersCardFactory.create("ListenerCard", "LinkCard", _this, round, card_elem);
			_this.addCard(link_card);
			link_card.answer = new Game.Answer(answer_spec);
		} catch (e) {
			console.log(e)
		}
	});
}
Util.extend(Game.Round.PromptLinkListener, Game.Round.Listener);

/* Each ListenerCard will capture input form the user(s).
 * Upon receiving user input, the card resolves the Listener's Deferred,
 * passing one of the Answer objects created from the YAML spec for this Round.
 */

/* FreeResponseCard just creates a card with a text input field and doesn't care about the answer. */
Game.ListenerCard.FreeResponseCard = function (args) {
	var round = args.shift();
	Util.extend_properties(this, new Game.Card({ div:"<input type=\"text\" />" }));
}
Util.extend(Game.ListenerCard.FreeResponseCard, Game.Card);

Game.ListenerCard.FreeResponseCard.prototype.dealTo = function (container, dfd) {
	Game.Card.prototype.dealTo.call(this, container, dfd);
	var _this = this;
	this.element.find("input[type=text]").on("keypress", function (e) {
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
		var btn_id = "radio_btn_" + round.nbr + "_" + (i + 1) + "_" + S4(); // random 4-character code.
		_this.radio_btns[btn_id] =
			{ html: ("<li><input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + btn_id + "\">" + answer.content + "</label></input></li>"),
			  answer: answer,
			  btn_id: btn_id
			}
	});
	var radio_btn_html = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
		return btn.html;
	}).join("\n");
	Util.extend_properties(this, new Game.Card(radio_btn_html));
}
Util.extend(Game.ListenerCard.MultipleChoiceCard, Game.Card);

Game.ListenerCard.MultipleChoiceCard.prototype.dealTo = function (container, dfd) {
	Game.Card.prototype.dealTo.call(this, container, dfd);
	var _this = this;
	this.element.find("input[type=radio]").on("click", function (e) {
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
 * This card waits for a click on a link. 
 */
Game.ListenerCard.LinkCard = function (args) {
	this.round = args.shift();
	var elem = args.shift();
	$(elem).attr("data-keep-in-dom", true);
	Util.extend_properties(this, new Game.Card(elem));
}
Util.extend(Game.ListenerCard.LinkCard, Game.Card);

Game.ListenerCard.LinkCard.prototype.dealTo = function (container, dfd) {
	var _this = this;
	this.element.click(function (e) {
		// disable the link after one click (maybe will want a double-click option at some point?)
		$(this).prop('disabled', true);
		// get answer & score, and pass them when resolving my promise (dfd).
		var correct = _this.answer.correct || false;
		var value = _this.answer.value || 1;
		var neg_value = _this.answer.negative_value || 0; // any penalty for answering incorrectly?
		var answer = new Game.Answer(_this.answer);
		var score = correct ? value : neg_value;
		dfd.resolve(answer, score);
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
 * TODO: add possibility of tailoring Responder w/in YAML, as is done with Prompter and Listener.
 */
Game.Round.Responder = function (round, spec) {
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Responder.DEFAULTS = {
		FeedbackType: "Simple" // just a text/html message in a Card.
	}
}
Util.extend(Game.Round.Responder, Game.Dealer);

Game.Round.Responder.prototype.init = function (answer, score) {
	// hang onto answer & score, so they are available to listeners of Round events.
	this.answer = answer;
	this.score = score;

	// get answer's feedback, if any.
	var feedback = [];
	if (typeof answer !== "undefined") {
		feedback = answer.feedback || [];
		if (typeof feedback === "string") {
			feedback = [{
				content: feedback
			}];
		}
	}

	// assemble cards made by all the feedback into my cards array.
	// careful, as 'feedback' is a mass noun: they are feedback; it is feedback.
	var _this = this;
	this.cards = $.map(feedback, function (feedback) {
		var feedback_type = feedback.type || Game.Round.Responder.DEFAULTS.FeedbackType
		return Game.DealersCardFactory.create("ResponderCard", feedback_type, _this, _this.round, answer, score);
	});
}

Game.ResponderCard.Simple = function (args) {
	var round = args.shift();
	var answer = args.shift();
	var score = args.shift();
	if (answer.feedback) {
		Util.extend_properties(this, new Game.Card(answer.feedback));
	}
}
Util.extend(Game.ResponderCard.Simple, Game.Card);