/* 
 * Responder
 * The Responder deals card(s) which give feedback to the user, based on their answer & its score.
 * TODO: add possibility of tailoring Responder w/in YAML, as is done with Prompter and Listener.
 */
Game.Round.Responder = Util.extendClass(Game.Dealer, function Game_Round_Responder (round, spec) {
	spec = spec || {};
	this.spec = spec;
	
	var container = (spec && spec.container) ? spec.container : round.container;
	Game.Dealer.call(this, round, container);
	
	// by default, we put up a Modal Feedback.
	this.accept_user_input = spec.accept_user_input || Game.Round.Responder.DEFAULTS.AcceptUserInput;
},
{
  init: function (answer, score) {
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
    
    if (typeof feedback["evaluate"] === "function") {
      feedback = feedback.evaluate(this.round);
    }
    
    if (!(feedback instanceof Array)) {
      feedback = [feedback];
    }

  	// assemble cards made by all the feedback into my cards array.
  	// careful, as 'feedback' is a mass noun: they are feedback; it is feedback.
  	var _this = this;
  	this.cards = $.map(feedback, function (feedback) {
  		var feedback_type = feedback.type || _this.constructor.DEFAULTS.FeedbackType
      return Game.DealersCardFactory.create("ResponderCard", feedback_type, _this, _this.round, feedback, answer, score);
  	});
  },

  respond: function () {
    // return this.waitForUserInput(this.accept_user_input);
    var _this = this;
    return this.deal().then(function () {
      return _this.waitForUserInput(_this.accept_user_input);
    });
  }
});

Game.Round.Responder.DEFAULTS = {
	FeedbackType: "Simple", // require click on this -- its a Modal Card.
	AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
}