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
		{ name: "timeout",		from: "ListenForPlayer",						to: "EvaluateResponse" },
		{ name: "advance",		from: "EvaluateResponse",						to: "end" },
		{ name: "abort",		from: StateMachine.WILDCARD,					to: "end" }
	];
		 
	// *** DEBUGGING ***
	this.onchangestate = function (name, from, to) {
		console.log(name + ": change state from " + from + " to " + to);
		this.game.element.get(0).style.webkitTransform = 'scale(1)'; // force a page redraw (webkit issue). 
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
		var _this = this;
		this.game.nextTick().then(function () {
			_this.prompt();
		});
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
	$.event.trigger("game.startClock", this.max_time || undefined);
	this.game.record({ event: "prompt given", prompt: this.prompter.report() });
	var _this = this;
	this.game.nextTick().then(function () {
		_this.listen();
	});
}

Game.Round.prototype.onListenForPlayer = function () {
	if (this.max_time !== "none"){
		// this.game.clock.start(this.max_time);
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

Game.Round.prototype.endListening = function (answer, score) {
	$.event.trigger("game.stopClock");
	// record user answer.
	this.game.record({ event: "user answers", answer: answer.getContents() });
	var _this = this;
	this.game.nextTick().then(function () {
		_this.evaluate(answer, score);
	});
}

Game.Round.prototype.onEvaluateResponse = function (eventname, from, to, answer, score) {
	this.game.addPoints(score);
	if (typeof this.responder === "string") {
		this.responder = new Game[this.responder](this, answer, score);
	}
	if (this.responder instanceof Game.Responder) {
		var endResponding = this.endResponding.bind(this);
		this.responder.dealCards(endResponding);
		return StateMachine.ASYNC;
	}
};

Game.Round.prototype.endResponding = function () {
	// record game's response to user.
	this.game.record({ event: "game responds", response: this.responder.report() });
	var _this = this;
	this.game.nextTick().then(function () {
		_this.advance();
	});
}

Game.Round.prototype.onbeforetimeout = function () {
	this.game.sendMessage("ran out of time.");
	$.event.trigger("game.stopClock");
};

Game.Round.prototype.onend = function () {
	// do any 'tear down' of the round. do also for ending/interrupting game?
	// this.game.clock.stop();
	// this.game.clock.reset();
	var tear_down = this.read("Teardown") || $.noop;
	tear_down.call(this);
	var _this = this;
	this.game.nextTick().then(function () {
		_this.game.newRound(_this.game);
	});
};