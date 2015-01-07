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
var environment = { mode: "development" }


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
		ScoreBoard: new ScoreBoard(),
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
	this.scoreboard = this.read("ScoreBoard");
	
	this.winning_score = this.read("WinningScore");

	// record the time the game was started.
	window.reporter.addData({ event: "start of game" });
	
	// start the game.
	/* later, build in a concept of returning to a saved game. */
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

	this.clock.init(this);
	this.current_score = 0; 
	this.scoreboard.init(this);
										
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
	this.current_score += points;
	this.scoreboard.add(points);
};

Game.prototype.gameFeedback = function () {
	var gameFeedbackMessage;
	if (this.current_score >= this.winning_score) {
		gameFeedbackMessage = this.read("WonGameFeedback");
	} else {
		gameFeedbackMessage = this.read("LostGameFeedback");
	}
	gameFeedbackMessage = gameFeedbackMessage.insert_values(this.current_score);
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
		in_production_try(this,
			function () {
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
		Answers: [],
		MaxTime: 5,
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
	this.answers = this.read("Answers") || Round.DEFAULTS.Answers;
	this.max_time = this.read("MaxTime") || Round.DEFAULTS.MaxTime;
	this.played_round = {}; // to store data of what happened in the round.

	
	this.events = [
		{ name: "start",		from: "none",									to: "SetupRound" },
		{ name: "prompt",		from: "SetupRound",								to: "GivePrompt" },
		{ name: "wait",			from: "GivePrompt",								to: "WaitForPlayer" },
		{ name: "respond",		from: "WaitForPlayer",							to: "EvaluateResponse" },
		{ name: "pass",			from: "WaitForPlayer",							to: "UserPasses" },
		{ name: "abort",		from: "WaitForPlayer",							to: "end" },
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
	$.extend(this, StateMachine.create({ events: this.events, 
										 error: function () { 
											 Array.prototype.unshift.call(arguments, "State Error:")
											 console.log(Array.prototype.slice.call(arguments)); 
										 } }));
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

Round.prototype.onSetupRound = function () {
	// do any presentation that sets up the round for the player(s).
	var presentation = this.read("Setup");
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
Round.prototype.onbeforeevaluate = function () {
	game.clock.stop();
};

//	user "passes" on their turn.
Round.prototype.onbeforepass = function () {
	game.clock.stop();
};

Round.prototype.onEvaluateResponse = function (eventname, from, to, answer) {
	/*** maybe pass something in from the YAML..? ***/
	/*** maybe return ASYNC, if we want to let responder widgets animate..? ***/
	this.score = this.responder.evaluateResponse();
	(this.score >= this.threshold_score) ? this.correct() : this.incorrect();
};

Round.prototype.onleaveEvaluateResponse = function (eventname /*, from, to */) {
	/* put in some feedback in addition to scoreboard. 
	   will have to think about what to allow, here.
	   this will probably be a place where we'll have to be especially flexible.
	   might be good to involve Dedra and/or Yianna in this discussion. */
	this.responder = new Responder(response_types, this);
};

Round.prototype.onCorrectResponse = function () {
	game.addPoints(this.score);
	this.advance();
};

Round.prototype.onIncorrectResponse = function () {
	game.addPoints(this.score);
	this.advance();
};

Round.prototype.onbeforetimeout = function () {
	game.sendMessage("ran out of time.");
	game.clock.stop();
};

Round.prototype.onbeforeadvance = function () {
	game.clock.stop();
	// do any 'tear down' of the round. do also for ending/interrupting game?
	var tear_down = this.read("Teardown") || this.defaultTeardown;
	tear_down.call(this);

	// write out the user data.
	in_production_try(this,
		function () {
			window.reporter.addData(this.played_round);
		}
	);
};

Round.prototype.defaultTeardown = function () {
	/* What should the default teardown actions be? Reset the clock? Remove Responder widgets? */
	game.clock.reset();
}

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
Responder.prototype.respond = function (answer) {
	this.round.respond(answer); // move on to the state of evaluating responses.
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
		console.log("Warning: Cannot find ResponseWidgetFactory." + response_type);
		return;
	}
	// we're going to always use Cards as our way of making 'moves' in a game,
	// whether initiated by the game or, eventually, by users.
	// Then, when we get to synchronous peer-to-peer games,
	// we'll have a standard way of presenting 'moves' sent by peers.
	// Also, cleaning up after Rounds should always just be a matter of removing Cards
	// that are no longer relevant.
	var widget;
	in_production_try(this,
		function () {
			// create widget and attach my responder. ask widget to create a Card.
			widget = new ResponseWidgetFactory[response_type](responder);
			// ensure that responder gets set.
			if (!widget.hasOwnProperty("responder")) {
				widget["responder"] = responder; 
			}
			// ensure that answers get set.
			try {
				widget.answers = responder.round.answers;
			} catch (e) {
				widget.answers = [];
			}
			widget.card = widget.getCard();
		}
	);
	return widget;
}

/* Each response widget type should provide a getContents() function that accepts no arguments,
 * and that returns a spec for creating a Card.
 */
ResponseWidgetFactory.MultipleChoice = function (responder) {
	this.round = responder.round;
	this.score = 0;
}
ResponseWidgetFactory.MultipleChoice.prototype.getCard = function() {
	// set up a Card with a form with radio buttons
	var widget = this;
	this.radio_btns = {};
	var group_name = "radio_group_" + this.round.nbr;
	$.each(this.answers, function (i, answer) {
		var btn_id = "radio_btn_" + widget.round.nbr + "_" + (i + 1);
		widget.radio_btns[btn_id] = 
			{ html: ("<input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"" + answer.text + "\">"
						+ "<label for=\"" + btn_id + "\">" + answer.text + "</label></input>"),
			  correct: answer["correct"] || false
			}
	});
	var content = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
		return btn.html;
	}).join("\n");
	var card_spec = {
		parts: { "form": "form" },
		content: content,
		container: Game
	}
	var card = new Card(card_spec);
	var default_deal = card.deal;
	card.deal = function () {
		card.elem.find("input[type=radio]").on("click", function(e) {
			var clicked_radio_btn = widget.radio_btns[e.target.id];
			widget.score = clicked_radio_btn.correct;
			widget.responder.respond(e.target.value);
		});
		default_deal.apply(card);
	}
	return card;
}
ResponseWidgetFactory.MultipleChoice.prototype.getScore = function() {
	// points associated with the clicked radio button, if its response marked "correct:true" in the YAML.
	return this.score;
}

// ResponseWidgetFactory.MultipleAnswer = function () {}
// ResponseWidgetFactory.MultipleAnswer.prototype.getCard = function() {
	/* set up a Card with a form with check boxes */
// }

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
				widget.responder.respond(this);
			}
		});
		default_deal.apply(card);
		card.elem.find("input[type=text]").focus();
	}
	return card;
}
ResponseWidgetFactory.FreeResponse.prototype.getScore = function() {
	// any response is fine by default in FreeResponse (eg; getting user's name).
	/*** need to create a ScoredTextResponse, with correctness function passed via YAML. ***/
	return 1;
}



/* 
 * Feedback
 * Default Feedback is just to deal a card with some text or HTML on it.
 * Similar method for getting Responses from the user: option for multiple widgets.
 * Should really focus on allowing many feeback types & also allowing logic for custom feedback.
 * Feedback objects just need a constructor and a give() method.
 */
function Feedback(feedback_types, responder) {
	Feedback.DEFAULTS = {
		Type: "Simple"
	}
	this.responder = responder;
	var feedback = this;
	this.widgets = $.map(feedback_types, function(feedback_type) {
		return FeedbackWidgetFactory.create([feedback_type || Feedback.DEFAULTS.Type], feedback);
	});
}
Feedback.prototype.give = function (answer) {
	// all widgets get the giveFeedback() command simulatenously, but a widget's giveFeedback()
	// might just enable it or put it into 'play' in some way (like an additional reward, barrier, or character).
	$.each(this.widgets, function (widget) {
		widget.giveFeedback();
	})
}

FeedbackWidgetFactory = {};

FeedbackWidgetFactory.Simple = function () {}
FeedbackWidgetFactory.Simple.prototype.getCard = function() {
	var card_spec = {
		content: "",
		container: Game
	}
	var card = new Card(card_spec);
	return card;
}


/* 
 * CountdownClock
 * This is a default clock -- it just puts numbers into a field, counting down from max_time for the Round.
 * Custom clocks need to expose init(game), start(max_time), stop(), and a tick() function, which should return the current time.
 */
function CountdownClock() {
	this.clock_face = $("textarea#clock");
}
CountdownClock.prototype.init = function (game) {
	this.game = game;
};
CountdownClock.prototype.start = function (max_time) {
	clearInterval(this.clock);
	this.clock = setInterval(this.tick.bind(this), 1000);
	this.clock_face.val(max_time);
};
CountdownClock.prototype.tick = function () {
	var current_time = this.clock_face.val() - 1;
	this.clock_face.val(current_time);
	if (current_time === 0) { 
		this.stop();
		game.timeoutRound(); 
	}
	return current_time;
};
CountdownClock.prototype.stop = function () {
	clearInterval(this.clock);
};


/* 
 * NullClock
 * If you don't want a clock, this will just fulfill the Clock commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
function NullClock() {}
NullClock.prototype.init = function (game) {}
NullClock.prototype.start = function (max_time) {}
NullClock.prototype.tick = function () { return undefined; }
NullClock.prototype.stop = function () {}



/* 
 * ScoreBoard
 * This is a default scoreboard -- it displays the current score in a field.
 * Custom scoreboards need to expose init(game), add(points), subtract(points), and a reset() functions.
 */
function ScoreBoard() {
	this.display = $("textarea#scoreboard");
}
ScoreBoard.prototype.init = function (game) {
	this.game = game;
	this.points = game.current_score;
	this.refresh();
};
ScoreBoard.prototype.add = function (points) {
	this.points += points;
	this.refresh();
	return this.points;
};
ScoreBoard.prototype.subtract = function (points) {
	this.points -= points;
	this.refresh();
	return this.points;
};
ScoreBoard.prototype.reset = function () {
	this.points = 0;
	this.refresh();
	return this.points;
};
ScoreBoard.prototype.refresh = function () {
	// fold in any special message, then display.
	var addPointsMessage = this.game.read("AddPoints") || ":points";
	addPointsMessage = addPointsMessage.insert_values(this.points);
	this.display.val(addPointsMessage);
};


/* 
 * NullScoreBoard
 * If you don't want a scoreboard, this will just fulfill the ScoreBoard commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
function NullScoreBoard() {}
NullScoreBoard.prototype.init = function (game) {}
NullScoreBoard.prototype.add = function (points) {}
NullScoreBoard.prototype.subtract = function (points) {}
NullScoreBoard.prototype.reset = function () {}
NullScoreBoard.prototype.refresh = function () {}




/*** Initializing the Game ***/
// This is what gets it all started. It gets called once we've retrieved & parsed a valid game YAML file.
function BuildGame(parsed_game_data) {
	in_production_try(this,
		function () {
			game = new Game(parsed_game_data);
		},
		function catch_func (e) {
			alert("Warning: cannot build game. " + e);
		}
	);
}