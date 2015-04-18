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

	this.container = this.read("Container") || game.container;
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

	this.tear_down = this.read("Teardown") || $.noop;
		 
	// *** MESSAGING ***
	// This is where we attach animations, etc through objects like the Scene object.
	// we allow them the opportunity to halt the advance into the next state by
	// sending them a continue flag, which they can trip.
	// we then return that to the state engine.
	this.onchangestate = function (name, from, to) {
		// console.log(name + ": change state from " + from + " to " + to);
		this.game.container.get(0).style.webkitTransform = 'scale(1)'; // force a page redraw (webkit issue). 
	}
	
	this.onenterstate = function (name, from, to /*, args... */) {
		var args = Array.prototype.slice.call(arguments);
		var name = args.shift();
		var from = args.shift();
		var to = args.shift();
		var event_info = { round: this, name: name, from: from, to: to, args: args, continue: true };
		$.event.trigger("Round.enter" + to, event_info);
	}

	this.onleavestate = function (name, from, to /*, args... */) {
		var args = Array.prototype.slice.call(arguments);
		var name = args.shift();
		var from = args.shift();
		var to = args.shift();
		var event_info = { round: this, name: name, from: from, to: to, args: args, continue: true };
		$.event.trigger("Round.leave" + from, event_info);
		return (event_info.continue) ? null : StateMachine.ASYNC;
	};

	// create a StateMachine to track what user can do in various situations.
	$.extend(this, StateMachine.create({ events: Game.Round.Events,
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

Game.Round.Events = 	// the available states, and the events that transition between them.
	[
		{ name: "prompt",		from: "none",									to: "GivePrompt" },
		{ name: "listen",		from: "GivePrompt",								to: "ListenForPlayer" },
		{ name: "evaluate",		from: "ListenForPlayer",						to: "EvaluateResponse" },
		{ name: "timeout",		from: "ListenForPlayer",						to: "EvaluateResponse" },
		{ name: "advance",		from: "EvaluateResponse",						to: "End" },
		{ name: "abort",		from: StateMachine.WILDCARD,					to: "End" }
	];

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
	// record the start time of the round.
	this.game.record({ round_nbr: this.nbr, event: "start of round" });
	// do any presentation that sets up the round for the player(s).
	var setup = this.read("Setup");
	if (typeof setup === "function") {
		// do setup(), which returns a dfd promise.
		setup.apply(this).then(this.prompt.bind(this));
		return StateMachine.ASYNC; // setup presentation happens before this.prompt();
	} else {
		var _this = this;
		this.game.nextTick().then(function () {
			_this.prompt();
		});
	}
};

Game.Round.prototype.onGivePrompt = function () {
	if (this.prompter instanceof Game.Round.Prompter) {
		this.prompter.init();
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
	if (this.listener instanceof Game.Round.Listener) {
		this.prompter.init();
		var endListening = this.endListening.bind(this);
		this.listener.dealCards(endListening);
		return StateMachine.ASYNC;
	} // if I failed to create a listener, this will just transition us into the next state.
};

Game.Round.prototype.endListening = function (answer, score) {
	// make any listener cards still onscreen unreceptive to user input (show them disabled).
	// this is the default behavior; a listener would have to override if inputs should stay active
	// past this point.
	this.listener.deactivateCards();
	
	$.event.trigger("game.stopClock");
	// record user's answer.
	var user_answer;
	try {
		user_answer = answer.getContents();
	} catch (e) {
		console.log("failed to get answer from user.", e.stack);
	}
	
	this.game.record({ event: "user answers", answer: user_answer });
	var _this = this;
	this.game.nextTick().then(function () {
		_this.evaluate(answer, score);
	});
}

Game.Round.prototype.onEvaluateResponse = function (eventname, from, to, answer, score) {
	this.game.addPoints(score);
	if (this.responder instanceof Game.Round.Responder) {
		this.responder.init(answer, score);
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

Game.Round.prototype.onbeforeabort = function (eventname, from, to, next_round, abort_tear_down) {
	if (abort_tear_down) {
		this.tear_down = abort_tear_down;
	}
	this.onEnd(eventname, from, to, next_round);
	return false; // don't continue with this event chain.
};

Game.Round.prototype.onEnd = function (eventname, from, to, next_round) {
	$.event.trigger("game.resetClock");
	
	// do any 'tear down' of the round. do also for ending/interrupting game?
	if ((this.tear_down instanceof YAML) && GameFunctionType.resolve(this.tear_down)) {
		var game_fn = GameFunctionType.construct(this.tear_down);
		game_fn.evaluate();
	} else if (typeof this.tear_down === "function") {
		this.tear_down();
	}
	var _this = this;
	this.game.nextTick().then(function () {
		_this.game.newRound(next_round || _this.read("Next"));
	});
};