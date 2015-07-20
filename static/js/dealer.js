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
	switch (true) {
		case (game_or_round instanceof Game):
			this.round = null;
			this.game = game_or_round;
			break;
			
		case (game_or_round instanceof Game.Round):
			this.round == game_or_round;
			this.game = game_or_round.game;
			break;
	}

	this.container = container;
	this.cards = [];
	this.deal_promises = [];
	
	Game.Dealer.NO_DEAL = [];
}


Game.Dealer.prototype.init = function () {
	// stub.
}


// this function examines all the cards to be dealt, and waits until they are all loaded before executing dealCards().
// it passes back the promise from dealCards to the original caller.
Game.Dealer.prototype.deal = function (cards_to_be_dealt, container, dealing_dfd) {
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
}


// default action for dealing cards is just to put them onscreen,
// and then resolve the promise right away.
Game.Dealer.prototype.dealCards = function (cards_to_be_dealt, container, dealing_dfd) {
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
		return dealing_dfd.promise();
	});
	
	// strip out duplicates.
	deal_promises = Array.getUnique(deal_promises);
	
	// $.when.apply() lets us put our array of promises into params of $.when().
	return $.when.apply($, this.deal_promises);
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


Game.Dealer.prototype.activateCards = function () {
	$.each(this.cards, function () {
		this.setActive(true);
	});
}


Game.Dealer.prototype.deactivateCards = function () {
	$.each(this.cards, function () {
		this.setActive(false);
	});
}


/* 
 * Some ways of waiting for the user to interact with Cards.
 */
Game.Dealer.prototype.waitForUserInput = function () {
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
			
		case "none":
			return this.game.internal_clock.nextTick();
			break;
			
		default:
			console.warn("Unknown 'accept user input' option:" + this.accept_user_input);
			return this.game.internal_clock.nextTick();
			break;
	}
}


Game.Dealer.prototype.waitForAnyUserInput = function () {
	var user_input_dfd = $.Deferred();
	// react to first user action.
	var _this = this;
	$(this.cards).each(function () {
		this.element.on("Card.userInput", function (evt, data) {
			// make any listener cards still onscreen unreceptive to user input (show them disabled).
			// this is the default behavior; a listener would have to override if inputs should stay active
			// past this point.
			_this.deactivateCards();
			user_input_dfd.resolve(data);
		});
	});
	return user_input_dfd.promise();
}


// this refers to presenting one card at-a-time to the user,
// and advancing through each one upon some interaction from the user.
// NOTEs: 
// - deals each of the cards upon resolution of prior card's interaction promise.
// - consumes this.cards, so the list will be empty. any cards added after are not dealt by this.
Game.Dealer.prototype.waitForEachUserInput = function () {
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
		return last_card.user_input_dfd.promise();
	} else {
		// return a generic promise.
		return dealer.game.internal_clock.nextTick();
	}
}


Game.Dealer.prototype.waitForAllUserInput = function () {
	var user_input_dfd = $.Deferred();
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
				user_input_dfd.resolve(collected_data);
			}
		});
	});
	return user_input_dfd.promise();
}


// remove one or more cards from my 'deck'.
Game.Dealer.prototype.discard = function (array_or_card) {
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
}


// forget all my cards.
Game.Dealer.prototype.discardAll = function () {
	$.each(this.cards, function () {
		this.element.remove();
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
 * Game.IntroDealer sets up the game & gives UI instructions.
 */
Game.IntroDealer = function (game, container) {
	Util.extend_properties(this, new Game.Dealer(game, container));
	
	Game.IntroDealer.DEFAULTS = {
		Type: "Modal", // a click-through Card.
		AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
	}
}
Util.extend(Game.IntroDealer, Game.Dealer);

Game.IntroDealer.prototype.introduce = function () {
	return this.waitForEachUserInput();
}



/* 
 * ROUND DEALERS -- PROMPTER, LISTENER, RESPONDER.
 */

/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Round.Prompter = function (round, spec) {
	spec = spec || {};
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Prompter.DEFAULTS = {
		Type: "Simple", // just a text/html message in a Card.
		AcceptUserInput: "none"
	}
	
	// by default, we just put up a Prompt; user inputs that will give answers are owned by the Prompter.
	this.accept_user_input = spec.accept_user_input || Game.Round.Prompter.DEFAULTS.AcceptUserInput;
	
	// deliver the prompt card(s) from the current Round spec.
	var _this = this;
	var prompts = round.read("Prompt");
	if ( !(prompts instanceof Array) ){ prompts = $.makeArray(prompts); }
	this.cards = $.map(prompts, function (prompt, i) {
		var prompt_card_type = prompt.prompt_type || Game.Round.Prompter.DEFAULTS.Type;
		return Game.DealersCardFactory.create("PromptCard", prompt_card_type, _this, prompt);
	});
}
Util.extend(Game.Round.Prompter, Game.Dealer);


Game.Round.Prompter.prototype.prompt = function () {
	var _this = this;
	return this.deal().then(function () {
		return _this.waitForUserInput(_this.accept_user_input);
	});
}


Game.PromptCard.Simple = function (args) {
	var spec = args.shift();
	Util.extend_properties(this, new Game.Card(spec));
}
Util.extend(Game.PromptCard.Simple, Game.Card);


Game.PromptCard.Modal = function (args) {
	var spec = args.shift();
	Util.extend_properties(this, new Game.Card.Modal(spec));
}
Util.extend(Game.PromptCard.Modal, Game.Card.Modal);
Game.PromptCard.Modal.prototype = new Game.Card.Modal(null); 


/* 
 * Listener
 * Each response_type creates a different drives the loading of some kind of widget. Lots of customization will probably happen here,
 * so expect this to get refactored over time.
 * Basic response widget types are: MultipleChoice (radio buttons), MultipleAnswer (check boxes), and FreeResponse (text field).
 * Other types can be defined in a game_utils.js file for a particular instance. 
 */
Game.Round.Listener = function (round, spec) {
	spec = spec || {};
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Listener.DEFAULTS = {
		UserInputTypes: ["MultipleChoice"],
		AcceptUserInput: "any"
	}
	// get *user* response types and insure it is an array.
	var user_input_types = spec.user_input_types|| spec.user_input_types || Game.Round.Listener.DEFAULTS.UserInputTypes;
	if (typeof user_input_types === "string") {
		user_input_types = [user_input_types];
	}
	// specify how user input will be interpreted (first answer taken, user must interact with all cards, etc.)
	this.accept_user_input = spec.accept_user_input || Game.Round.Listener.DEFAULTS.AcceptUserInput;
	
	// assemble cards made by all the user_input_types into my cards array.
	var _this = this;
	this.cards = $.map(user_input_types, function (user_input_type) {
		var listener_card_type = (user_input_type || Game.Round.Listener.DEFAULTS.UserInputType) + "Card";
		return Game.DealersCardFactory.create("ListenerCard", listener_card_type, _this, round);
	});
}
Util.extend(Game.Round.Listener, Game.Dealer);


// The Listener should deal cards that are initially in a disabled state. They will be enabled upon listen().
Game.Round.Listener.prototype.deal = function (cards_to_be_dealt, container, dealing_dfd) {
	this.deactivateCards();
	return Game.Dealer.prototype.deal.call(this, cards_to_be_dealt, container, dealing_dfd);
}


// Activate cards. Create a Deferred object. and pass it to each card.
// They decide how to resolve it (perhaps in combination)?
Game.Round.Listener.prototype.listen = function () {
	this.activateCards();
	return this.waitForUserInput();
}


/*
 * PromptLinkListener -- listens for clicks on links embedded in the Prompt card(s).
 */
Game.Round.PromptLinkListener = function (round, spec) {
	spec = spec || {};
	spec.user_input_types = []; // we don't want any Listener Cards created; we just use the links in the Prompt(s).
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
		$.merge(prompt_links, this.element.find("a"));
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


Game.ListenerCard.FreeResponseCard.prototype.dealTo = function (container) {
	Game.Card.prototype.dealTo.call(this, container);
	var _this = this;
	this.element.find("input[type=text]").on("keypress", function (e) {
        if (e.keyCode === 13) {
			var answer = new Game.Answer(e.target.value);
			var score = 1; // any response is accepted.
			$(_this.element).trigger("Card.userInput", answer, score);
			e.target.blur();
		}
	});
	this.element.find("input[type=text]").focus();
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


Game.ListenerCard.MultipleChoiceCard.prototype.dealTo = function (container) {
	Game.Card.prototype.dealTo.call(this, container);
	var _this = this;
	this.element.find("input[type=radio]").on("click", function (e) {
		var clicked_radio_btn = _this.radio_btns[e.target.id];
		var correct = clicked_radio_btn.answer.correct || false;
		var value = clicked_radio_btn.answer.value || 1;
		var neg_value = clicked_radio_btn.answer.negative_value || 0; // any penalty for answering incorrectly?
		var answer = new Game.Answer(clicked_radio_btn.answer);
		var score = correct ? value : neg_value;
		$(_this.element).trigger("Card.userInput", answer, score);
	});
}


/* 
 * This card waits for a click on a link. 
 * args passed as an array.
 */
Game.ListenerCard.LinkCard = function (args) {
	this.round = args.shift();
	var elem = args.shift();
	$(elem).attr("data-keep-in-dom", true);
	Util.extend_properties(this, new Game.Card(elem));
}
Util.extend(Game.ListenerCard.LinkCard, Game.Card);


Game.ListenerCard.LinkCard.prototype.dealTo = function (container) {
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
		_this.element.trigger("Card.userInput", {answer: answer, score: score});
	});
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
	spec = spec || {};
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	Game.Round.Responder.DEFAULTS = {
		FeedbackType: "Simple", // require click on this -- its a Modal Card.
		AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
	}
	
	// by default, we put up a Modal Feedback.
	this.accept_user_input = spec.accept_user_input || Game.Round.Responder.DEFAULTS.AcceptUserInput;
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


Game.Round.Responder.prototype.respond = function () {
	var _this = this;
	return this.deal().then(function () {
		return _this.waitForUserInput(_this.accept_user_input);
	});
}



Game.ResponderCard.Simple = function (args) {
	var round = args.shift();
	var answer = args.shift();
	var score = args.shift();
	if (answer.feedback) {
		Util.extend_properties(this, new Game.Card.Modal(answer.feedback));
	}
}
Util.extend(Game.ResponderCard.Simple, Game.Card.Modal);