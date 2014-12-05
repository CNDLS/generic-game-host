/* global $:false -- jQuery. */
/* global defer:false */
/* global Game:false */
/* global Round:false */
/* global Card:false */
/* global CountdownClock:false */
/* global StateMachine:false */

/* jslint latedef:false, unused:false */

/******************************************************************************
 * Generic Game Engine
 * Copyright (c) 2014 Bill Garr and CNDLS, Georgetown University -- https://github.com/CNDLS/generic-game-host
 * Released under Creative Commons license -- http://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * VERSION 0.1.0
 * (release notes to go here).
 ******************************************************************************/

var game;

/* 
 * Game
 */
function Game(game_spec) {
	Game.DEFAULTS = {
		Title: "Generic Game",
		Clock: new CountdownClock(),
		Rounds: [],
		Utilities: {},
		Intro: "Welcome to the game!",
		Resources: {},
		WinningScore: 1,
		WonGameFeedback: "<h3>Hey, you won!</h3>",
		LostGameFeedback: "<h3>That didn't work out so well; you lost. Better luck next time!</h3>"
	};
	
	this.spec = game_spec;
	this.spec.setDefaultContext(this);
	
	this.current_round = undefined;
	this.round_nbr = 0;
	
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.clock = this.read("Clock");
	
	this.winning_score = this.read("WinningScore");

	// record the time the game was started.
	window.reporter.addData({ event: "start of game" });
	
	// start the game.
	this.setup();
}

Game.prototype.setup = function () {
	// introduce any explanatory note. place them on onscreen "cards," styled for each game.
	var intro_prompt = this.read("Intro");
	// attach spec for an intro card to the game, so we can optionally edit it in a setup_function.
	this.intro_card = {
		title: "Introduction",
		content: intro_prompt,
		class: "intro",
		container: "#cards",
		okClick: this.newRound.bind(this)
	};
	
	this.cumulative_score = 0;
										
	// collect any global_resources that may become available to the user throughout the game.
	// attach global_resources to the game, so we can optionally edit them in a setup_function.
	this.global_resources = this.read("Resources");
	
	// deliver the intro card. we will require a click-through on this card.
	createCard(this.intro_card);
};

Game.prototype.timeoutRound = function () {
	this.current_round.timeout();
};

Game.prototype.addPoints = function (points) {
	this.cumulative_score += points;
	this.points_display.val(this.cumulative_score);
	var addPointsMessage = this.spec.read("AddPoints", ":points".insert_values(points));
	addPointsMessage = addPointsMessage.insert_values(points);
	this.sendMessage(addPointsMessage);
};

Game.prototype.gameFeedback = function () {
	var gameFeedbackMessage;
	if (this.cumulative_score >= this.winning_score) {
		gameFeedbackMessage = this.read("WonGameFeedback");
	} else {
		gameFeedbackMessage = this.read("LostGameFeedback");
	}
	gameFeedbackMessage = gameFeedbackMessage.insert_values(this.cumulative_score);
	var feedback_card = {
		title: "Summary",
		content: gameFeedbackMessage,
		class: "ruling",
		container: "#cards"
	};
	createCard(feedback_card);
	this.sendMessage(gameFeedbackMessage);
};

Game.prototype.read = function (fieldName, defaultValue) {
	if (this.spec.get(fieldName) !== undefined) { return this.spec.get(fieldName); }
	if (defaultValue !== undefined) { return defaultValue; }
	if (Game.DEFAULTS[fieldName] !== undefined) { return Game.DEFAULTS[fieldName]; }
	return undefined;
};

Game.prototype.sendMessage = function (msgText) {
	console.log(" - " + msgText);
};

Game.prototype.allowReplay = function () {
	$("#top .replay").show();
};

Game.prototype.newRound = function () {
	// do reporting here.
	// only advance upon successfully reporting progress.
	// if there"s a communications failure, we"ll at least know when it happened.
	window.reporter.sendReport(function () {
		try {
			if (game.rounds.count() > 0) {
				delete game.current_round;
				++game.round_nbr;
				game.current_round = new Round(game.rounds.shift());
				game.current_round.start();
			} else {
				game.gameFeedback();
				game.allowReplay();
			}
		} catch (e) {
			game.gameFeedback();
			game.allowReplay();
		}
	});
};



/* 
 * Rounds of the Game.
 */
function Round(round_spec) {
	if (round_spec === undefined) {
		console.log("no round_spec provided");
		return;
	}
	
	this.nbr = game.round_nbr;
	this.spec = round_spec;
	this.spec.setDefaultContext(game);

	Round.DEFAULTS = {
		Points: 1,
		Resources: {},
		MaxTime: 2,
		Prompt: {
			title: function (round) { "Round :nbr".insert_values(round.nbr); },
			content: prompt,
			class: "round_prompt",
			container: "#cards"
		},
		WonRoundFeedback: "<h3>Good Round!</h3>",
		LostRoundFeedback: "<h3>Sorry, you lost that round.</h3>"
	};
	
	this.resources = this.spec.get("Resources") || Round.DEFAULTS.Resources;
	this.pointValue = this.spec.get("Points") || Round.DEFAULTS.Points;
	this.max_time = this.spec.get("MaxTime") || Round.DEFAULTS.MaxTime;
	this.played_round = {}; // to store data of what happened in the round.

	
	this.events = [
		{ name: "start",		from: "none",									to: "PresentRound" },
		{ name: "prompt",		from: "PresentRound",							to: "GivePrompt" },
		{ name: "wait",			from: "GivePrompt",								to: "WaitForPlayer" },
		{ name: "respond",		from: "WaitForPlayer",							to: "UserResponds" },
		{ name: "pass",			from: "WaitForPlayer",							to: "UserPasses" },
		{ name: "evaluate",		from: "UserResponds",							to: "EvaluateResponse" },
		{ name: "correct",		from: "EvaluateResponse",						to: "CorrectResponse" },
		{ name: "incorrect",	from: "EvaluateResponse",						to: "IncorrectResponse" },
		{ name: "timeout",		from: "WaitForPlayer",							to: "IncorrectResponse" },
		{ name: "advance",		from: ["CorrectResponse", "IncorrectResponse"],	to: "end" }
	];
		 
	// *** DEBUGGING ***
	this.onchangestate = function (name, from, to) {
		console.log(name + ": " + from + " to " + to);
	};
	
	// INTIALIZING THE ROUND.
	this.spec.get("SetUp");

	// create a StateMachine to track what user can do in various situations.
	$.extend(this, StateMachine.create({ events: this.events }));
}

Round.prototype.onstart = function (/* eventname, from, to */) {
	game.sendMessage("Starting Round " + this.nbr);
	// record the start time of the round.
	window.reporter.addData({ round_nbr: this.nbr, event: "start of round" });
	this.prompt();
};

Round.prototype.onPresentRound = function () {
	// do any presentation that sets up the round for the player(s).
	var presentation = this.spec.get("Present");
	return presentation ? StateMachine.ASYNC : false;
};

Round.prototype.onGivePrompt = function () {
	var custom_prompt = this.spec.get("Prompt") || false;
	var prompt = custom_prompt ? $.extend(Round.DEFAULTS.Prompt, custom_prompt) : Round.DEFAULTS.Prompt;
	// deliver the prompt card.
	createCard(prompt);
};

Round.prototype.onWaitForPlayer = function () {
	game.clock.start(this.max_time);
};

// doing a little more cleanup now, before we issue the ruling.
Round.prototype.onbeforeevaluate = function () {
	game.clock.stop();
};

//	user "passes" on their turn.
Round.prototype.onbeforepass = function () {
	game.clock.stop();
};

Round.prototype.onEvaluateResponse = function () {
	// s/b custom. find user response and compare to some stored values.
	// this is a stub, to be replaced by a round_initer function in the YAML game spec. 
	var correct = true;
	if (correct) {
		this.correct();
	} else {
		this.incorrect();
	}
};

Round.prototype.onleaveEvaluateResponse = function (eventname /*, from, to */) {
	var ruling_card = {
		content: prompt,
		class: "ruling",
		container: "#cards"
	};
	// deliver the prompt card. we will require a click-through on this card.
	createCard(ruling_card);
	this.ruling_card = $(createCard(eventname.capitalize().past_tense() + ".", "", "ruling", "#questions"));
  
	return StateMachine.ASYNC;
};

Round.prototype.onCorrectResponse = function () {
	game.addPoints(this.pointValue);
	this.advance();
};

Round.prototype.onIncorrectResponse = function () {
	this.advance();
};

Round.prototype.onbeforetimeout = function () {
	game.sendMessage("ran out of time.");
	game.clock.stop();
};

Round.prototype.onbeforeadvance = function () {
	try {
		// write out the user data.
		window.reporter.addData(this.played_round);
	} catch (e) { console.log(e); }
};

Round.prototype.onend = function () {
	defer(game.newRound, game);
};



/* 
 * Cards
 * Use a template in the html page to generate "cards," any (potentially animated) messages to the player.
 * note: providing	spec.<key> || false suppresses KeyNotFound errors.
 */
function Card(spec) {
	var _this = this;
	
	Card.DEFAULTS = {
		template: $("#card_template").html(),
		timeout: null,
		parts: { "label": "H2" }
	};
	
	// spec can contain template, title, content, class, container.
	// spec *must* contain at least content and container.
	var card_holder = $(document.createElement("div"));
	card_holder.html(spec.card_template || Card.DEFAULTS.template);
	this.card_front = card_holder.find(".front") || card_holder;

	this.parts = $.extend(spec.parts || {}, Card.DEFAULTS.parts);
	
	// get all the elements in the template.
	this.elements = {};
	this.card_front.find("*").each(function () {
		if (this instanceof HTMLElement) {
			var classnames = $(this).attr("class") || false;
			var selector = this.nodeName + ((classnames) ? "." + classnames.split(" ").join(".") : "");
			if (_this.parts[selector]) {
				_this.elements[_this.parts[selector]] = this;
			} else {
				$(this).remove(); // pull out from the card template any HTML elements that aren't used in this card.
			}
		}
	});
	
	if (spec.class || false) { card_holder.find("div.card").addClass(spec.class); }
	
	$.each(this.parts, function (key, value) {
		if (spec.hasOwnProperty(key)) {
			_this.card_front.find(value).html(spec[key] || "");
		}
	});
	
	
	if (spec.content && (spec.content !== "")) {
		this.card_front.append(spec.content);
	}
	if ((spec.okClick || false) && (typeof spec.okClick === "function")) {
		this.addOKButton(spec.okClick);
	} else if (spec.timeout || false) {
		// hold on the card for some predetermined time.
		if ((game.current_round.transition) && (typeof game.current_round.transition === "function")) {
			setTimeout(game.current_round.transition.bind(game), spec.timeout || Card.DEFAULTS.timeout);
		}
		// else, just leave the card up indefinitely.
	}
	
	// the card holder is just temporary. put the card within it into the container.
	this.elem = card_holder.children().first();
	$(spec.container).append(this.elem);
}

Card.prototype.addOKButton = function (onclick_handler) {
	// once the user clicks to continue, we can move onto the game.
	// for now, we"re going to stick to the notion that all intros require a click to continue.
	var card = this;
	var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function () {
		card.elem.remove();
		setTimeout(function () { onclick_handler.call(); }, 500); // pause before triggering animations?
	});
	ok_button.appendTo(this.card_front);
};


function createCard(spec) {
	var card = new Card(spec);
	return $(card.elem);
}

/* 
 * CountdownClock
 * This is a default clock -- it just puts numbers into a field, counting down from max_time for the Round.
 * Custom clocks need to expose start(), stop(), and a tick() function, which should return the current time.
 */
function CountdownClock() {
	this.clock_face = $("textarea#clock");
}

CountdownClock.prototype.start = function (max_time) {
	clearInterval(this.clock);
	this.clock = setInterval(this.tick.bind(this), 1000);
	this.clock_face.val(max_time);
};

CountdownClock.prototype.tick = function () {
	var current_time = this.clock_face.val() - 1;
	this.clock_face.val(current_time);
	if (current_time === 0) { game.timeoutRound(); }
};

CountdownClock.prototype.stop = function () {
	clearInterval(this.clock);
};



// This is what gets it all started. It gets called once we've retrieved & parsed a valid game YAML file.
function BuildGame(parsed_game_data) {
	try {
		game = new Game(parsed_game_data);
	} catch (err) {
		alert("Warning: cannot build game. " + err);
		Error.captureStackTrace(err);
		console.log(err.stack);
	}
}