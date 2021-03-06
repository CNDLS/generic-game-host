/* 
 * Listener
 * Each response_type creates a different drives the loading of some Cards. Lots of customization will probably happen here,
 * so expect this to get refactored over time.
 * Basic response Card types are: MultipleChoice (radio buttons), MultipleAnswer (check boxes), and FreeResponse (text field).
 * Other types can be defined in a game_utils.js file for a particular instance. 
 * NOTE: It may seem weird to define user_input_types as an array, but in the case of multiple concurrent valid inputs, where
 * the answers are not specified ahead of time (eg; are calculated on-the-fly), this gets us whatever cards we'll need.
 */
Game.Round.Listener = Util.extendClass(Game.Dealer, function Game_Round_Listener (round, spec) {
	this.round = round;
	spec = spec || {};
	this.spec = spec;
	
	var container = (spec && spec.container) ? spec.container : round.container;
	Game.Dealer.call(this, round, container);

	// get *user* response types and insure it is an array.
	this.user_input_types = spec.user_input_types|| spec.user_input_types || Game.Round.Listener.DEFAULTS.UserInputTypes;
	if (typeof this.user_input_types === "string") {
		this.user_input_types = [this.user_input_types];
	}
	// specify how user input will be interpreted (first answer taken, user must interact with all cards, etc.)
	this.accept_user_input = spec.accept_user_input || Game.Round.Listener.DEFAULTS.AcceptUserInput;
},
{ 
  init: function () {	// assemble cards made by all the user_input_types into my cards array.
  	var _this = this;
  	this.cards = $.map(this.user_input_types, function (user_input_type) {
  		var listener_card_type = (user_input_type || Game.Round.Listener.DEFAULTS.UserInputType) + "Card";
  		return Game.DealersCardFactory.create("ListenerCard", listener_card_type, _this, _this.round);
  	});
  },
  
  deal: function (cards_to_be_dealt, container, dealing_dfd) {
  	this.deactivateCards();
  	return Game.Dealer.prototype.deal.call(this, cards_to_be_dealt, container, dealing_dfd);
  },
  
  listen: function () {
  	this.activateCards();
  	return this.waitForUserInput();
  }
});

Game.Round.Listener.DEFAULTS = {
	UserInputTypes: ["MultipleChoice"],
	AcceptUserInput: "any"
}



/*
 * PromptLinkListener -- listens for clicks on links embedded in the Prompt card(s).
 */
Game.Round.PromptLinkListener = Util.extendClass(Game.Round.Listener, function Game_Round_PromptLinkListener (round, spec) {
	spec = spec || {};
	spec.user_input_types = []; // we don't want any Listener Cards created; we just use the links in the Prompt(s).
	Game.Round.Listener.call(this, round, spec);
},
{ 
  init: function () {
  	// I don't need a ResponseType -- by default, I just scan
  	// the Prompt for links, and call those my cards. I attach a click
  	// listener to each to set up promises.
  	// Of course, this all relies on the Prompt still being available onscreen.
  	// What to do about mis-matches between nbr of links in the Prompt 
  	// and nbr of answers listed in the spec?
  	var _this = this;
  	var prompt_links = [];
  	$(this.round.prompter.cards).each(function () {
  		$.merge(prompt_links, this.element.find("a"));
  	});
  	$.each(this.round.answers, function (i, answer_spec) {
  		var link_id = "prompt_" + _this.round.nbr + "_" + (i + 1) + "_" + S8(); // random 4-character code.
  		try {
  			var card_elem = prompt_links[i];
  			var link_card = Game.DealersCardFactory.create("ListenerCard", "LinkCard", _this, _this.round, card_elem);
  			_this.addCard(link_card);
  			link_card.answer = new Game.Round.Answer(answer_spec, _this.round);
  		} catch (e) {
  			console.log(e)
  		}
  	});
  }
});



/*
 * GroupedInputsListener -- listens for clicks on inputs (eg; checkboxes) in groups.
 */
Game.Round.GroupedInputsListener = Util.extendClass(Game.Round.Listener, function Game_Round_GroupedInputsListener (round, spec) {
	// this will necessarily require more than one user action, 
	// so we hide any 'continue' buttons, collect all user_input_promises, and resolve upon a click on our Submit button.
	spec.user_input_types = ["GroupedInput"];
	Game.Round.Listener.call(this, round, spec);
},
{
  init: function () {
    // call super to load any group card.
    Game.Round.Listener.prototype.init.call(this);
  	this.group_card = this.cards.shift();
	
  	// this listener offers the option of a header card, apart from any Prompt
  	// that may act to organize the cards that follow (eg; table headers).
  	var header_spec = this.spec.header || false;
  	if (header_spec) {
  		this.group_card.element.render(header_spec);
  	}
  
  	// this listener gets AnswerGroups rather than just Answers.
  	var answer_groups = this.round.read("AnswerGroups");
  	var s8 = S8();
  	var _this = this;
  	if ((typeof answer_groups === "object") && (answer_groups instanceof YAML.Array)) {
  		// each Answer object in this case is a group of inputs and a mini-prompt.
  		for (var i=0; i < answer_groups.length; i++) {
  			var answer_group_spec = answer_groups[i];
  			var group_id = (answer_group_spec.group || (i + 1)); // random 4-character code.
  			answer_group_spec.group_name = _this.round.nbr + "_" + s8 + "_" + group_id;
  			var member_card_type = (answer_group_spec.user_input_types || Game.Round.Listener.DEFAULTS.UserInputTypes[0]) + "Card";
  			var member_card = Game.DealersCardFactory.create("ListenerCard", member_card_type, _this, _this.round, answer_group_spec);
        member_card.container = this.group_card.container;
  			this.addCard(member_card);
  		}
  	}
	
  	if (this.spec.submit_button || false) {
  		// collect Answers from all cards, so we can report it upon the submit click.
  		this.accept_user_input = "collect";
  		// add the bit where we wait for the user.
  		this.user_input_dfd = $.Deferred();
  		this.user_input_promise = this.user_input_dfd.promise();
  	}
  },

  deal: function (cards_to_be_dealt, container, dealing_dfd) {
  	// deal the group card in the normal way.
  	var card_promises = [];
  	var group_card_promise = Game.Round.Listener.prototype.deal.call(this, [this.group_card], container, dealing_dfd);
  	card_promises.push(group_card_promise);
  	var member_card_promises = Game.Round.Listener.prototype.deal.call(this, this.cards, this.group_card.element, dealing_dfd);
  	var card_promises = card_promises.concat(member_card_promises);
	
  	// add a submit button, if spec calls for one.
  	if (this.spec.submit_button || false) {
  		// collect all responses upon submit click.
  		var submit_btn_html = "<div class='submit_container'><button type='submit' value='submit'>Submit</button></div>";
  		this.group_card.element.append(submit_btn_html);
  		var respondToSubmitBtn = this.respondToSubmitBtn.bind(this);
  		this.group_card.element.find("button[type=submit]").on("click", respondToSubmitBtn);

  	} else {
  		// TODO: write case of collecting responses when a submit button is not present.
  	}
  	return $.when.apply($, card_promises);
  },
  
  respondToSubmitBtn: function (evt) {
  	// check completeness -- are all required Answers provided?
  	var answers = [];
  	var scores = [];
  	$(this.collected_data).each(function () {
  		answers.push(this.answer.getContents());
  		scores.push(this.score);
  	});
  	if (this.spec.require === "all") {
  		if (this.collected_data.length < this.cards.length) {
  			// fail 'validation'.
  			this.promptUserForMoreInput();
  		} else {
  			// send grouped answers and scores.
  			var answer = new Game.Round.Answer({ content: answers }, this.round);
  			$(this.group_card.element).trigger("Card.userInput", { answer: answer, score: scores });
  			this.user_input_dfd.resolve({ answer: answer, score: scores });
  		}
  	} else {
  		// allow items to specify themselves as required.
  		// also allow grouped spec, like we do assigning Scenes to Rounds (eg; [1..4, 6])?
  	}
  },

  promptUserForMoreInput: function () {
  	alert("Please complete all items."); // TODO: replace with a Game.alert(), so we can customize.
  	// this.member_cards.each(function () {
  	// 	if (!this.answer)
  	// });
  },
  
  // Deactivate only the input in the clicked control's group card.
  deactivateCards: function (card) {
  	// bury the command if we are waiting for a submit click,
  	// unless the spec says to go ahead.
  	if ((this.spec.submit_button || false) && !(this.spec.deactivate_cards || false)) {
  		return;
  	}
  	if (card) { 
  		// can pass in a single card to deactivate.
  		card.setActive(false);
  	} else {
  		$.each(this.cards, function () {
  			this.setActive(false);
  		});
  	}
  }
});




/* 
 * Answers are how the user's actions are communicated to the program. 
 * They need to have a getContents() function, which describes what the user input.
 * Answers don't need to provide any other functionality, but are there in case
 * a ListenerCard wants to do something special with them --
 * since ListenerCards cause Answers to be created, they can create their
 * own types.
 * Answers originate in the YAML spec, and they can specify feedback.
 */
Game.Round.Answer = function Game_Round_Answer (spec, context) {
	if (typeof spec === "string") {
		spec = { content: spec };
	}
  // keep track of params.
  this.spec = spec;
  this.context = context;

  if (typeof spec['evaluate'] === 'function') {
    spec = spec.evaluate(context);
  }
  
	$.extend(this, spec);
}

// add things to Game.Round.Answer.prototype.
Game.Round.Answer.prototype = $.extend(Game.Round.Answer.prototype.prototype, {

  // allow answers to be pre-defined elements (eg; SetPieces or Widgets)
  getContents: function () {
    // handle ref's to our media_url.
    this.content = Util.replaceAll(this.content, /MEDIA_URL\+/g, MEDIA_URL);

    // check if content is a selector. if so, see if element exists.
    var content_is_selector = $.render.tag_id_class_regexp.test(this.content);
    if (content_is_selector && $(this.content).length) {
      return $(this.content).html();
    } else {
      return $.render(this.content).html;
    }
  },
  
  get: function (key, context) {
    if (typeof this.spec["get"] === "function") {
      return this.spec.get(key, context || this.context);
    } else {
      return this.spec[key] || null;
    }
    
  }
});