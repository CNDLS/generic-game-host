/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Round.Prompter = function (round, spec) {
	this.round = round;
	spec = spec || {};
	this.spec = spec;
	
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	// by default, we just put up a Prompt; user inputs that will give answers are owned by the Prompter.
	this.accept_user_input = spec.accept_user_input || Game.Round.Prompter.DEFAULTS.AcceptUserInput;
}
Util.extend(Game.Round.Prompter, Game.Dealer);

Game.Round.Prompter.DEFAULTS = {
	Type: "Simple", // just a text/html message in a Card.
	AcceptUserInput: "none"
}


Game.Round.Prompter.prototype.init = function () {
	// deliver the prompt card(s) from the current Round spec.
	var prompts = this.round.read("Prompt");
	if ( !(prompts instanceof Array) ){ prompts = $.makeArray(prompts); }

	var _this = this;
	this.cards = $.map(prompts, function (prompt, i) {
		var prompt_card_type = prompt.prompt_type || Game.Round.Prompter.DEFAULTS.Type;
		return Game.DealersCardFactory.create("PromptCard", prompt_card_type, _this, prompt);
	});
}

Game.Round.Prompter.prototype.prompt = function () {
	var _this = this;
	return this.deal().then(function () {
		return _this.waitForUserInput(_this.accept_user_input);
	});
}