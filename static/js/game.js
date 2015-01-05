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


// script to start things off by getting the appropriate YAML file & parsing it.
$(function(){
	if ($ === undefined) { return; }
	this.script_tag = $("script#reader");
	if (this.script_tag.length === 0) { return; }
	this.read_url = this.script_tag.attr("read-from");

	$.ajax(
	{
		url: this.read_url,
		type: "GET",
		success: function (data /* , textStatus, XMLHttpRequest */) {
			// send the parsed data to the callback.
			var parsed_game_data;
			try {
				parsed_game_data = new YAML(jsyaml.safeLoad(data, { schema: GAME_SCHEMA }));
			} catch (err) {
				alert("Warning: cannot parse game file. " + err);
				console.log(err);
				return;
			}
			BuildGame(parsed_game_data);
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		}
	});
});



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
	
	this.current_round = undefined;
	this.round_nbr = 0;
	this.container = $("#game");
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.clock = this.read("Clock");
	this.points_display = $("#points");
	
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
		klass: "intro",
		container: "#cards",
		okClick: this.newRound.bind(this)
	};
	
	this.cumulative_score = 0;
										
	// collect any global_resources that may become available to the user throughout the game.
	// attach global_resources to the game, so we can optionally edit them in a setup_function.
	this.global_resources = this.read("Resources");
	
	// deliver the intro card. we will require a click-through on this card.
	this.intro_card = new Card(this.intro_card);
	this.intro_card.deal();
};

Game.prototype.timeoutRound = function () {
	this.current_round.timeout();
};

Game.prototype.addPoints = function (points) {
	this.cumulative_score += points;
	this.points_display.val(this.cumulative_score);
	var addPointsMessage = this.read("AddPoints") || ":points";
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
		klass: "ruling",
		container: "#cards"
	};
	feedback_card = new Card(feedback_card);
	feedback_card.deal();
	this.sendMessage(gameFeedbackMessage);
};

Game.prototype.read = function (fieldName /* , defaultValue */ ) {
	if (!this.hasOwnProperty("spec")) { 
		console.log("Warning: Game spec not defined.");
		return undefined;
	}
	var defaultValue = arguments[1] || undefined;
	var rtn_val = this.spec.get(fieldName);
	if (rtn_val === undefined && (typeof defaulValue !== "undefined")) { rtn_val = defaulValue; }
	if (rtn_val === undefined && (typeof Game.DEFAULTS[fieldName] !== "undefined")) { rtn_val = Game.DEFAULTS[fieldName]; }
	if (rtn_val === undefined) {
		console.log("Alert: Cannot provide a '" + fieldName + "' from Game spec or defaults.");
	}
	return rtn_val;
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
	// if there's a communications failure, we'll at least know when it happened.
	window.reporter.sendReport(function () {
		in_production_try(
			function try_func () {
				if (game.rounds.count() > game.round_nbr) {
					delete game.current_round;
					++game.round_nbr;
					// NOTE: have to use get(), rather than array index ([]),
					// so we can trigger !evaluate, if need be.
					game.current_round = new Round(game.rounds.get(game.round_nbr - 1));
					game.current_round.start();
				} else {
					game.gameFeedback();
					game.allowReplay();
				}
			}, 
			function catch_func (e) {
				Error.captureStackTrace(e);
				console.log(e.stack);
				game.gameFeedback();
				game.allowReplay();
			})
	});
};

Game.prototype.abort = function() {
	// this is our way of cleaning up following a fatal error.
	delete this;
}



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

	Round.DEFAULTS = {
		Points: 1,
		Threshold: 1,
		Resources: {},
		MaxTime: 2,
		Prompt: {
			title: function (round) { "Round :nbr".insert_values(round.nbr); },
			content: prompt,
			klass: "round_prompt",
			container: "#cards"
		},
		WonRoundFeedback: "<h3>Good Round!</h3>",
		LostRoundFeedback: "<h3>Sorry, you lost that round.</h3>"
	};
	
	this.pointValue = this.read("Points") || Round.DEFAULTS.Points;
	this.threshold_score = this.read("Threshold") || Round.DEFAULTS.Threshold;
	this.resources = this.read("Resources") || Round.DEFAULTS.Resources;
	this.max_time = this.read("MaxTime") || Round.DEFAULTS.MaxTime;
	this.played_round = {}; // to store data of what happened in the round.

	
	this.events = [
		{ name: "start",		from: "none",									to: "PresentRound" },
		{ name: "prompt",		from: "PresentRound",							to: "GivePrompt" },
		{ name: "wait",			from: "GivePrompt",								to: "WaitForPlayer" },
		{ name: "respond",		from: "WaitForPlayer",							to: "EvaluateResponse" },
		{ name: "pass",			from: "WaitForPlayer",							to: "UserPasses" },
		{ name: "correct",		from: "EvaluateResponse",						to: "CorrectResponse" },
		{ name: "incorrect",	from: "EvaluateResponse",						to: "IncorrectResponse" },
		{ name: "timeout",		from: "WaitForPlayer",							to: "IncorrectResponse" },
		{ name: "advance",		from: ["CorrectResponse", "IncorrectResponse"],	to: "end" }
	];
		 
	// *** DEBUGGING ***
	this.onchangestate = function (name, from, to) {
		console.log(name + ": change state from " + from + " to " + to);
	};
	
	// INTIALIZING THE ROUND.
	this.read("SetUp");

	// create a StateMachine to track what user can do in various situations.
	$.extend(this, StateMachine.create({ events: this.events }));
}

Round.prototype.read = function (fieldName /* , defaultValue */ ) {
	if (!this.hasOwnProperty("spec")) { 
		console.log("Warning: Round spec not defined.");
		return undefined;
	}
	var defaultValue = arguments[1] || undefined;
	var rtn_val = this.spec.get(fieldName);
	if (rtn_val === undefined && (typeof defaulValue !== "undefined")) { rtn_val = defaulValue; }
	if (rtn_val === undefined && (typeof Round.DEFAULTS[fieldName] !== "undefined")) { rtn_val = Round.DEFAULTS[fieldName]; }
	if (rtn_val === undefined) {
		console.log("Alert: Cannot provide a '" + fieldName + "' from Round spec or defaults.");
	}
	return rtn_val;
};

Round.prototype.onstart = function (/* eventname, from, to */) {
	game.sendMessage("Starting Round " + this.nbr);
	// record the start time of the round.
	window.reporter.addData({ round_nbr: this.nbr, event: "start of round" });
	this.prompt();
};

Round.prototype.onPresentRound = function () {
	// do any presentation that sets up the round for the player(s).
	var presentation = this.read("Present");
	return presentation ? StateMachine.ASYNC : false;
};

Round.prototype.onGivePrompt = function () {
	var prompt = this.read("Prompt");
	// deliver the prompt card.
	prompt = new Card(prompt);
	prompt.deal();
	
	this.wait();
};

Round.prototype.onWaitForPlayer = function () {
	game.clock.start(this.max_time);
	// trigger response, based on the ResponseTypes.
	var response_types = this.read("ResponseTypes");
	if (typeof response_types === "string") {
		response_types = [response_types];
	}
	this.responder = new Responder(response_types, this);
	if (this.responder && typeof this.responder["deal"] === "function") {
		this.responder.deal();
		return StateMachine.ASYNC;
	} else {
		return false;
	}
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
	/*** maybe pass something in from the YAML..? ***/
	/*** maybe return ASYNC, if we want to let responder widgets animate..? ***/
	this.score = this.responder.evaluateResponse();
	(this.score >= this.threshold_score) ? this.correct() : this.incorrect();
};

Round.prototype.onleaveEvaluateResponse = function (eventname /*, from, to */) {
	// var score_card = {
	// 	content: prompt,
	// 	klass: "score_card",
	// 	container: "#cards"
	// };
	// // deliver the score_card. we will require a click-through on this card.
	// score_card = new Card(score_card);
	// score_card.deal();
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
 * Card prototype specifies a generic 'deal' function, but that can be overridden by 'deal' function passed in a card spec.
 */
function Card(spec) {
	var _this = this;
	
	if (typeof spec === "string") {
		spec = { content: spec };
	} else if (typeof spec === "number") {
		spec = { content: spec.toString() };
	}
	
	Card.DEFAULTS = {
		template: $("#card_template").html(),
		timeout: null,
		parts: { "label": "H2" },
		container: Game
	};
	
	// spec can contain template, title, klass, container, and deal <function>.
	// spec *must* contain content.
	var card_holder = $(document.createElement("div"));
	card_holder.html(spec.card_template || Card.DEFAULTS.template);
	this.card_front = card_holder.find(".front") || card_holder;

	this.parts = $.extend(spec.parts || {}, Card.DEFAULTS.parts);
	this.container = spec.container || Card.DEFAULTS.container;
	
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
	
	if (spec.klass || false) { card_holder.find("div.card").addClass(spec.klass); }
	
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

Card.prototype.deal = function () {
	if (this.container === Game){
		this.container = window.game.container;
	}
	$(this.container).append(this.elem);
}



/* 
 * Responses
 * each response_type creates a different drives the loading of some kind of widget. Lots of customization will probably happen here,
 * so expect this to get refactored over time.
 * Basic response widget types are: MultipleChoice (radio buttons), MultipleAnswer (check boxes), and FreeResponse (text field).
 * Other types can be defined in a game_utils.js file for a particular instance. 
 */
function Responder(response_types, round) {
	Responder.DEFAULTS = {
		Type: "MultipleChoice"
	}
	this.round = round;
	var responder = this;
	this.widgets = $.map(response_types, function(response_type) {
		return ResponseWidgetFactory.create([response_type || Responder.DEFAULTS.Type], responder);
	});
}
Responder.prototype.deal = function () {
	$.each(this.widgets, function (index, widget) {
		if ( widget.hasOwnProperty("card") && (widget.card instanceof Card) ) {
			widget.card.deal();
		}
	});
}
Responder.prototype.respond = function () {
	this.round.respond(); // move on to the state of evaluating responses.
}
Responder.prototype.evaluateResponse = function () {
	/*** what to do about being partially correct? or correct-ness that is cumulative across widgets? ***/
	var rtn_val = 0;
	$.each(this.widgets, function (index, widget) {
		if (typeof widget.getScore === "function"){ rtn_val += widget.getScore(); }
	});
	return rtn_val;
}

function ResponseWidgetFactory() {}

ResponseWidgetFactory.create = function (response_type, responder) {
	if (!ResponseWidgetFactory.hasOwnProperty(response_type)) {
		console.log("Cannot find ResponseWidgetFactory." + response_type);
		if (game){ game.abort(); }
	}
	var widget = new ResponseWidgetFactory[response_type]();
	// we're going to always use Cards as our way of making 'moves' in a game,
	// whether initiated by the game or, eventually, by users.
	// Then, when we get to synchronous peer-to-peer games,
	// we'll have a standard way of presenting 'moves' sent by peers.
	// Also, cleaning up after Rounds should always just be a matter of removing Cards
	// that are no longer relevant.
	widget.responder = responder;
	widget.card = widget.getCard();
	return widget;
}

/* Each response widget type should provide a getContents() function that accepts no arguments,
 * and that returns a spec for creating a Card.
 */
ResponseWidgetFactory.MultipleChoice = function () {}
ResponseWidgetFactory.MultipleChoice.prototype.getCard = function() {
	/* set up a Card with a form with radio buttons */
}

ResponseWidgetFactory.MultipleAnswer = function () {}
ResponseWidgetFactory.MultipleAnswer.prototype.getCard = function() {}

ResponseWidgetFactory.FreeResponse = function () {}
ResponseWidgetFactory.FreeResponse.prototype.getCard = function() {
	var card_spec = {
		parts: { "form": "form" },
		content: "<input type=\"text\" />",
		container: Game
	}
	var card = new Card(card_spec);
	var default_deal = card.deal;
	var widget = this;
	card.deal = function () {
		card.elem.find("input[type=text]").on("keypress", function(e) {
	        if (e.keyCode === 13) {
				widget.responder.respond();
			}
		});
		default_deal.apply(card);
	}
	return card;
}
ResponseWidgetFactory.FreeResponse.prototype.getScore = function() {
	// any response is fine by default in FreeResponse (eg; getting user's name).
	/*** need to create a ScoredTextResponse, with correctness function passed via YAML. ***/
	return 1;
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