/* FAILSAFE */
Game = Game || function () {};

/* 
 * Rounds of the Game.
 */
Game.Round = function (game, round_spec) {
	if (round_spec === undefined) {
		console.log("no round_spec provided");
		return;
	}
	
	this.game = game;
	this.nbr = this.game.round_nbr;
	this.spec = round_spec;
	
	this.read = Game.prototype.read.bind(this);
	
	this.pointValue = this.read("Points");
	this.threshold_score = this.read("Threshold");
	this.resources = this.read("Resources");
	this.answers = this.read("Answers");
	this.max_time = this.read("MaxTime");
	this.played_round = {}; // to store data of what happened in the round.

	// the three managers which will guide the round through its states.
	this.prompter = this.read("Prompter");
	this.listener = this.read("Listener");
	this.responder = this.read("Responder");
	
	// the available states, and the events that transition between them.
	this.events = [
		{ name: "prompt",		from: "none",									to: "GivePrompt" },
		{ name: "listen",		from: "GivePrompt",								to: "ListenForPlayer" },
		{ name: "evaluate",		from: "ListenForPlayer",						to: "EvaluateResponse" },
		{ name: "advance",		from: "EvaluateResponse",						to: "end" },
		{ name: "abort",		from: StateMachine.WILDCARD,					to: "end" }
	];
		 
	// *** DEBUGGING ***
	this.onchangestate = function (name, from, to) {
		console.log(name + ": change state from " + from + " to " + to);
	};

	// create a StateMachine to track what user can do in various situations.
	$.extend(this, StateMachine.create({ events: this.events,
										 error: function () {
											 Array.prototype.unshift.call(arguments, "State Error:")
											 console.log(Array.prototype.slice.call(arguments));
											 // try to recover the calling stack of the original error.
											 try {
												 console.error(arguments[7].stack);
											 } catch (e) {}
										 }
									 	}));
	
	// PERFORM ANY SETUP FOR THE ROUND.
	this.setup();
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
	Prompter: "Prompter",
	Listener: "Listener",
	Responder: "Responder",
	WonRoundFeedback: "<h3>Good Round!</h3>",
	LostRoundFeedback: "<h3>Sorry, you lost that round.</h3>"
};

Game.Round.prototype.setup = function () {
	this.game.sendMessage("Starting Round " + this.nbr);
	// record the start time of the round.
	this.game.record({ round_nbr: this.nbr, event: "start of round" });
	// do any presentation that sets up the round for the player(s).
	var setup = this.read("Setup");
	if (typeof setup === "function") {
		// do setup(), which returns a dfd promise.
		setup.apply(this).then(this.prompt.bind(this));
		return StateMachine.ASYNC; // setup presentation is responsible for issuing this.prompt();
	} else {
		this.game.defer(this.prompt.bind(this));
	}
};

Game.Round.prototype.onGivePrompt = function () {
	if (typeof this.prompter === "string") {
		this.prompter = new Game[this.prompter](this);
	}
	if (this.prompter instanceof Game.Prompter) {
		var endPrompting = this.endPrompting.bind(this);
		this.prompter.dealCards(endPrompting);
		return StateMachine.ASYNC;
	} // if prompter fails, this will just transition us into the next state.
};

Game.Round.prototype.endPrompting = function () {
	this.game.element.get(0).style.webkitTransform = 'scale(1)'; // force a page redraw (webkit issue). 
	this.game.record({ event: "prompt given", prompt: this.prompter.report() });
	this.game.defer(this.listen.bind(this));
}

Game.Round.prototype.onListenForPlayer = function () {
	if (this.max_time !== "none"){
		game.clock.start(this.max_time);
	}
	if (typeof this.listener === "string") {
		this.listener = new Game[this.listener](this);
	}
	if (this.listener instanceof Game.Listener) {
		var endListening = this.endListening.bind(this);
		this.listener.dealCards(endListening);
		return StateMachine.ASYNC;
	} // if listener fails, this will just transition us into the next state.
};

Game.Round.prototype.endListening = function () {
	this.game.element.get(0).style.webkitTransform = 'scale(1)'; // force a page redraw (webkit issue). 
	this.game.record({ event: "response given", prompt: this.listener.report() });
	// this.game.defer(this.evaluate.bind(this));
}

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
	this.score = this.listener.evaluateResponse();
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