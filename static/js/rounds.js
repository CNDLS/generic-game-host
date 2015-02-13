/* FAILSAFE */
Game = Game || function () {};

/* 
 * Rounds of the Game.
 */
Game.Round = function (round_spec) {
	if (round_spec === undefined) {
		console.log("no round_spec provided");
		return;
	}
	
	this.nbr = game.round_nbr;
	this.spec = round_spec;
	
	this.read = Game.prototype.read.bind(this);
	
	this.pointValue = this.read("Points");
	this.threshold_score = this.read("Threshold");
	this.resources = this.read("Resources");
	this.answers = this.read("Answers");
	this.max_time = this.read("MaxTime");
	this.played_round = {}; // to store data of what happened in the round.

	
	this.events = [
		{ name: "start",		from: "none",									to: "GivePrompt" },
		{ name: "wait",			from: "GivePrompt",								to: "WaitForPlayer" },
		{ name: "evaluate",		from: "WaitForPlayer",							to: "EvaluateResponse" },
		{ name: "advance",		from: "EvaluateResponse",						to: "end" },
		{ name: "abort",		from: StateMachine.WILDCARD,					to: "end" }
	];
		 
	// *** DEBUGGING ***
	this.onchangestate = function (name, from, to) {
		console.log(name + ": change state from " + from + " to " + to);
	};
	
	// INTIALIZING THE ROUND.
	this.read("SetUp");

	// create a StateMachine to track what user can do in various situations.
	$.extend(this, StateMachine.create({ events: this.events,
										 error: function () {
											 Array.prototype.unshift.call(arguments, "State Error:")
											 console.error(Array.prototype.slice.call(arguments));
										 }
									 	}));
}

Game.Round.DEFAULTS = {
	Points: 1,
	Threshold: 1,
	Resources: {},
	Answers: [],
	MaxTime: 5,
	Prompt: {
		title: function (round) { "Round :nbr".insert_values(round.nbr); },
		content: prompt,
		css_class: "round_prompt"
	},
	WonRoundFeedback: "<h3>Good Round!</h3>",
	LostRoundFeedback: "<h3>Sorry, you lost that round.</h3>"
};

Game.Round.prototype.onstart = function (/* eventname, from, to */) {
	game.sendMessage("Starting Round " + this.nbr);
	// record the start time of the round.
	game.record({ round_nbr: this.nbr, event: "start of round" });
	// do any presentation that sets up the round for the player(s).
	var presentation = this.read("Setup");
	return presentation ? StateMachine.ASYNC : false;
};

Game.Round.prototype.onGivePrompt = function () {
	this.prompter = new Game.Prompter(this);
	// var prompt = this.read("Prompt");
	// // deliver the prompt card.
	// var prompt_card = Game.Card.create(prompt);
	// // record when prompt was given.
	// game.record({ event: "prompt given", prompt: prompt });
	// prompt_card.deal(this.wait);
};

Game.Round.prototype.onWaitForPlayer = function () {
	if (this.max_time !== "none"){
		game.clock.start(this.max_time);
	}
	// trigger response, based on the ResponseTypes.
	var response_types = this.read("ResponseTypes");
	if (typeof response_types === "string") {
		response_types = [response_types];
	}
	this.responder = new Responder(response_types, this);
	if (this.responder 
		&& typeof this.responder["deal"] === "function"
		&& this.responder.widgets.length ) {
		this.responder.deal();
		return StateMachine.ASYNC;
	} else {
		// exit this round;
		this.abort();
	}
};
// doing a little more cleanup now, before we issue feedback.
Game.Round.prototype.onbeforeevaluate = function () {
	game.clock.stop();
};

//	user "passes" on their turn.
Game.Round.prototype.onbeforepass = function () {
	game.clock.stop();
};

Game.Round.prototype.onEvaluateResponse = function (eventname, from, to, feedback) {
	// answer object originates from the YAML. It is given a score value by the Responder & its Widgets.
	/*** return ASYNC if we want to let responder widgets animate. How to specify that? ***/
	this.score = this.responder.evaluateResponse();
	feedback.score = this.score;
	// record user response.
	game.record({ event: "user answers", answer: feedback.answer, score: feedback.score });
	(this.score >= this.threshold_score) ? this.correct(feedback) : this.incorrect(feedback);
};

Game.Round.prototype.onCorrectResponse = function (eventname, from, to, feedback) {
	feedback.give();
	game.addPoints(this.score);
	this.game.defer(this.advance, this);
};

Game.Round.prototype.onIncorrectResponse = function (eventname, from, to, feedback) {
	feedback.give();
	game.addPoints(this.score);
	this.game.defer(this.advance, this);
};

Game.Round.prototype.onbeforetimeout = function () {
	game.sendMessage("ran out of time.");
	game.clock.stop();
};

Game.Round.prototype.onbeforeadvance = function () {
	game.clock.stop();
	// do any 'tear down' of the round. do also for ending/interrupting game?
	var tear_down = this.read("Teardown") || this.defaultTeardown;
	tear_down.call(this);
};

Game.Round.prototype.defaultTeardown = function () {
	/* What should the default teardown actions be? Reset the clock? Remove Responder widgets? */
	game.clock.reset();
}

Game.Round.prototype.onend = function () {
	this.game.defer(game.newRound, game);
};