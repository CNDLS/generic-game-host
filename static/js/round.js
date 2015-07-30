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
	
	this.roundID = guid(); // requires reporter.js
	
	this.read = Game.prototype.read.bind(this);

	this.container = this.read("Container") || game.container;
	this.pointValue = this.read("Points");
	this.threshold_score = this.read("Threshold");
	this.resources = this.read("Resources");
	this.answers = this.read("Answers");
	this.max_time = this.read("MaxTime");
	this.played_round = { guid: this.roundID }; // to store data of what happened in the round.

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
		var evt_rtn = $.event.trigger("Round.leave" + from, event_info);
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
		{ name: "prompt",			from: "none",												to: "PromptPlayer" },
		{ name: "listen",			from: "PromptPlayer",								to: "ListenForPlayer" },
		{ name: "respond",		from: "ListenForPlayer",						to: "RespondToPlayer" },
		{ name: "timeout",		from: "ListenForPlayer",						to: "RespondToPlayer" },
		{ name: "advance",		from: "RespondToPlayer",						to: "End" },
		{ name: "abort",			from: StateMachine.WILDCARD,				to: "End" }
	];

Game.Round.DEFAULTS = {
	Points: 1,
	Resources: {},
	Answers: [],
	MaxTime: 5,
	OnTimeout: "GiveWrongAnswer",
	Prompt: {
		title: function (round) { "Round :nbr".insert_values(round.nbr); },
		content: prompt,
		css_class: "round_prompt"
	},
	Prompter: "Prompter",
	Listener: "Listener",
	Responder: "Responder"
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
	} else  {
		// if scene has changed, put up the new one.
		var reset_scene, prompt_without_scene;
		try {
			var prior_scene = this.game.scenes[this.game.prior_round_nbr];
			if (prior_scene === undefined) {
				reset_scene = true;
			} else {
				reset_scene = (prior_scene.rounds.indexOf(this.nbr) === -1);
			}
		} catch (e) {
			reset_scene = true;
		}

		var round = this;
		if (reset_scene) {
			try {
				// remove prior scene.
				$(".backdrop").remove();
				var current_scene = this.game.scenes[this.nbr];
				current_scene.setup(round).then(function () {
					round.prompt();
				});
			} catch (e) {
				prompt_without_scene = true;
			}
		} else {
			prompt_without_scene = true;
		}
		if (prompt_without_scene) {
			this.game.nextTick().then(function () {
				round.prompt();
			});
		}
	}
};

Game.Round.prototype.onPromptPlayer = function () {
	if (this.prompter instanceof Game.Round.Prompter) {
		this.prompter.init();
		// wait for any user actions that may be required
		// to complete the prompt (eg; clicking through multiple Modal cards).
		this.prompter.prompt().then(this.endPrompting.bind(this));
		return StateMachine.ASYNC;
	} // if prompter fails, this will just transition us into the next state.
};

Game.Round.prototype.endPrompting = function () {
	this.game.record({ event: "prompt given", prompt: this.prompter.report() });
	var _this = this;
	this.game.nextTick().then(function () {
		_this.listen();
	});
}

Game.Round.prototype.onListenForPlayer = function () {
	if (this.listener instanceof Game.Round.Listener) {
		this.listener.init();
		var _this = this;
		this.listener.deal()
		.then(function () {
			_this.game.record({ event: "start listening", prompt: _this.listener.report() });
			$.event.trigger("game.startClock", _this.max_time || undefined);
			return _this.listener.listen();
		})
		.then(function (data) {
			// collect an array of data into a single, concatenated answer and an array of scores.
			if (data instanceof Array) {
				var collected_answer_content = $(data).collect(function () {
					return this.answer.content;
				});
				var collected_scores = $(data).collect(function () {
					return this.score;
				});
				data = { answer: new Answer(collected_answer_content), score: collected_scores }
			}
			_this.endListening(data.answer, data.score);
		});
	} else {
		// if I failed to create a listener, just transition to the round.
		this.abort();
	}
	return StateMachine.ASYNC;
};

Game.Round.prototype.endListening = function (answer, score) {
	$.event.trigger("game.stopClock");
	// record user's answer.
	var user_answer;
	try {
		user_answer = answer.getContents();
	} catch (e) {
		console.log("failed to get answer from user.", e.stack);
	}

	this.game.addPoints(score);
	this.game.record({ event: "user answers", answer: user_answer });
	this.respond(answer, score);
}

Game.Round.prototype.onRespondToPlayer = function (eventname, from, to, answer, score) {
	if (this.responder instanceof Game.Round.Responder) {
		this.responder.init(answer, score);
		// wait for any user actions that may be required
		// to complete the prompt (eg; clicking through multiple Modal cards).
		this.responder.respond().then(this.endResponding.bind(this));
		return StateMachine.ASYNC;
	}
};

Game.Round.prototype.endResponding = function () {
	// record game's response to user.
	this.game.record({ event: "game responds", response: this.responder.report() });
	this.advance();
}

// default behavior upon timeout. give the first non-correct answer you find in the spec.
Game.Round.prototype.GiveWrongAnswer = function () {
	var a_wrong_answer = $(this.answers).select(function () {
		return !this.correct;
	})
	a_wrong_answer = (a_wrong_answer.length) ? a_wrong_answer[0] : new Game.Answer();
	return { answer: a_wrong_answer, score: a_wrong_answer.negative_value || 0 }
}

Game.Round.prototype.onbeforeabort = function (eventname, from, to, next_round, abort_tear_down) {
	if (abort_tear_down) {
		this.tear_down = abort_tear_down;
	}
	this.onEnd(eventname, from, to, next_round);
	return false; // don't continue with this event chain.
};

Game.Round.prototype.cancelTransition = function () {
	if (this.transition && (typeof this.transition === "function")) {
		this.transition.cancel();
	}
}

Game.Round.prototype.onEnd = function (eventname, from, to, next_round) {
	$.event.trigger("game.resetClock");
	this.doTearDown();
	var _this = this;
	this.game.nextTick().then(function () {
		_this.game.record({ event: "round transition", old_round: _this.played_round });
		// if a next_round is passed in, use that, or
		// if Round YAML specifies a "Next" round to go to, use that, or
		// the game will just read the next one in the list, or will conclude if there is none.
		_this.game.newRound(next_round || _this.read("Next"));
	});
};

Game.Round.prototype.doTearDown = function () {
	// do any 'tear down' of the round. do also for ending/interrupting game.
	if ((this.tear_down instanceof YAML) && GameFunctionType.resolve(this.tear_down)) {
		var game_fn = GameFunctionType.construct(this.tear_down);
		game_fn.evaluate();
	} else if (typeof this.tear_down === "function") {
		this.tear_down();
	}
}