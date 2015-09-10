/* 
 * Responder
 * The Responder deals card(s) which give feedback to the user, based on their answer & its score.
 * TODO: add possibility of tailoring Responder w/in YAML, as is done with Prompter and Listener.
 */
Game.Round.Responder = function (round, spec) {
	spec = spec || {};
	this.spec = spec;
	
	var container = (spec && spec.container) ? spec.container : round.container;
	Util.extend_properties(this, new Game.Dealer(round, container));
	
	// by default, we put up a Modal Feedback.
	this.accept_user_input = spec.accept_user_input || Game.Round.Responder.DEFAULTS.AcceptUserInput;
}
Util.extend(Game.Round.Responder, Game.Dealer);

Game.Round.Responder.DEFAULTS = {
	FeedbackType: "Simple", // require click on this -- its a Modal Card.
	AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
}


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