/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */

Game.Round.Prompter = Util.extendClass(Game.Dealer, function (round, spec) {
	this.round = round;
	spec = spec || {};
	this.spec = spec;
	
	var container = (spec && spec.container) ? spec.container : round.container;
	Game.Dealer.call(this, round, container);
	
	// by default, we just put up a Prompt; user inputs that will give answers are owned by the Prompter.
	this.accept_user_input = spec.accept_user_input || Game.Round.Prompter.DEFAULTS.AcceptUserInput;
},
{
  init: function () {
  	// deliver the prompt card(s) from the current Round spec.
  	var prompts = this.round.read("Prompt");
  	if ( !(prompts instanceof Array) ){ prompts = $.makeArray(prompts); }

  	var _this = this;
  	this.cards = $.map(prompts, function (prompt, i) {
  		var prompt_card_type = prompt.prompt_type || Game.Round.Prompter.DEFAULTS.Type;
  		return Game.DealersCardFactory.create("PromptCard", prompt_card_type, _this, prompt);
  	});
  },

  prompt: function () {
  	var _this = this;
  	return this.deal().then(function () {
  		return _this.waitForUserInput(_this.accept_user_input);
  	});
  }
});

Game.Round.Prompter.DEFAULTS = {
	Type: "Simple", // just a text/html message in a Card.
	AcceptUserInput: "none"
}



/* 
 * The CallAndResponsePrompter handles some initial choice that defines a round.
 * Typically, the choice triggers a change in the prompt message.
 */

Game.Round.CallAndResponsePrompter = Util.extendClass(Game.Round.Prompter, function (round, spec) {
	Game.Round.Prompter.call(this, round, spec);
  this.data = spec.data;
	this.input_selector = spec.input_selector || Game.Round.CallAndResponsePrompter.DEFAULTS.InputSelector;
	this.accept_user_input = spec.accept_user_input || Game.Round.CallAndResponsePrompter.DEFAULTS.AcceptUserInput;
},
{ 
  init: function () {
    Game.Round.Prompter.prototype.init.call(this);
    var prompter = this;
    $.each(this.cards, function () {
      var card = this;
      $(this.element).find(prompter.input_selector).click(function () {
        $(card.element).find(prompter.input_selector).attr("disabled", "disabled");
        $(this).addClass("chosen");
        prompter.choice = $(this).html();
        prompter.chosen_item = prompter.data[prompter.choice];
        $(card.element)
        .render({ p: prompter.chosen_item })
        .trigger("Card.userInput", { choice: prompter.choice });
      });
    });
  }
});

Game.Round.CallAndResponsePrompter.DEFAULTS = {
	AcceptUserInput: "any",
  InputSelector: "button"
}