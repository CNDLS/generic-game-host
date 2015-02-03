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
	Game.record({ event: "start of game" });
	
	// start the game.
	/* later, build in a concept of returning to a saved game. */
	defer(this.setup, this);
}


/*
 * 'static' functions on the Game object that collect data & triggers writing out data to the server.
 * encapsulate it, so we can swap backends more easily.
 *
 */
Game.record = function (data) {
	// write out the user data.
	in_production_try(this,
		function () {
			window.reporter.addData(data);
		}
	);
}

Game.report = function (report_round, catch_func) {
	window.reporter.sendReport(function () {
		in_production_try(this, report_round, catch_func);
	});
}


Game.prototype.setup = function () {
	// introduce any explanatory note. place them on onscreen "cards," styled for each game.
	var intro_spec = this.read("Intro");
	if (typeof intro_spec === "string"){
		intro_spec = { content: intro_spec };
	}
	// attach spec for an intro card to the game, so we can optionally edit it in a setup_function.
	$.extend(intro_spec, {
		css_class: "intro",
		okClick: this.newRound.bind(this)
	});

	this.clock.init(this);
	this.current_score = 0; 
	this.scoreboard.init(this);
										
	// collect any global_resources that may become available to the user throughout the game.
	// attach global_resources to the game, so we can optionally edit them in a setup_function.
	this.global_resources = this.read("Resources");
	
	// deliver the intro card. we will require a click-through on this card.
	this.intro_card = Game.Card.create(intro_spec);
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
	var feedback_spec = {
		content: gameFeedbackMessage,
		css_class: "game_summary"
	};
	var feedback_card = Game.Card.create(feedback_spec);
	feedback_card.deal();
	// add to the msg stream as well.
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
		console.log("Cannot provide a '" + fieldName + "' from Game spec or defaults.");
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
	Game.report(
		function report_round() {
			if (game.rounds.count() > game.round_nbr) {
				++game.round_nbr;
				// NOTE: have to use get(), rather than array index ([]),
				// so we can trigger !evaluate, if need be.
				game.current_round = new Round(game.rounds.get(game.round_nbr - 1));
				defer(game.current_round.start, game.current_round);
			} else {
				game.gameFeedback();
				game.allowReplay();
			}
		}, 
		function catch_func (e) {
			game.gameFeedback();
			game.allowReplay();
		}
	);
};

Game.prototype.abort = function() {
	// this is our way of cleaning up following a fatal error.
	// nothing to do here in a generic way, but maybe we'll want the option of a game tearDown()?
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
			css_class: "round_prompt"
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
											 console.error(Array.prototype.slice.call(arguments)); 
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
	Game.record({ round_nbr: this.nbr, event: "start of round" });
	defer(this.prompt, this);
};

Round.prototype.onSetupRound = function () {
	// do any presentation that sets up the round for the player(s).
	var presentation = this.read("Setup");
	return presentation ? StateMachine.ASYNC : false;
};

Round.prototype.onGivePrompt = function () {
	var prompt = this.read("Prompt");
	// deliver the prompt card.
	var prompt_card = Game.Card.create(prompt);
	prompt_card.deal();
	// record when prompt was given.
	Game.record({ event: "prompt given", prompt: prompt });
	defer(this.wait, this);
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

Round.prototype.onEvaluateResponse = function (eventname, from, to, feedback) {
	// answer object originates from the YAML. It is given a score value by the Responder & its Widgets.
	/*** return ASYNC if we want to let responder widgets animate. How to specify that? ***/
	this.score = this.responder.evaluateResponse();
	(this.score >= this.threshold_score) ? this.correct() : this.incorrect();
	// record user response.
	Game.record({ event: "user answers", answer: feedback.answer });
	// provide feedback. This is triggered by the Round, so we can control the game state that it happens within.
	// if the feedback requires animation, give() must return StateMachine.ASYNC.
	return feedback.give();
};

Round.prototype.onCorrectResponse = function () {
	game.addPoints(this.score);
	defer(this.advance, this);
};

Round.prototype.onIncorrectResponse = function () {
	game.addPoints(this.score);
	defer(this.advance, this);
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
 * Cards represent interactions with the player. They are represented by some DOM element(s).
 * The generic Card prototype specifies a generic 'deal' function, 
 * but that can be overridden by 'deal' function passed in a card spec.
 * Alternately, other Card prototypes can be defined on the Game object,
 * specifying animations, interactivity, even peer-to-peer communications through "cards."
 */
Game.Card = function(spec) {
	if (typeof spec === "string") {
		spec = { content: { "div": spec } };
	} else if (typeof spec === "number") {
		spec = { content: { "div": spec.toString() } };
	}
	this.spec = spec;
	
	Game.Card.DEFAULTS = {
		timeout: null,
		container: $("#cards")
	};
	
	// spec can contain template, klass, css_class, container, and deal <function>.
	// spec *must* contain content.
	// card_scaffold is a temporary structure. the card gets pulled out of it when 'dealt.'
	var card_scaffold = $(document.createElement("div"));
	this.element = $(document.createElement("div")).addClass("card");
	card_scaffold.append(this.element);
	// apply any general css_class in the spec to the first child of the card_holder.
	if (spec['css_class']) {
		this.element.addClass(spec.css_class);
	}
	this.card_front = $(document.createElement("div")).addClass("front");
	this.element.append(this.card_front);
	this.container = spec.container || Game.Card.DEFAULTS.container;
}

Game.Card.prototype.populate = function () {
	var spec = this.spec;
	// each card population is wrapped in a try.
	in_production_try(this,
		function () {
			if (typeof spec.content === "string" && spec.content.is_valid_html()) {
				this.card_front.append(spec.content);
			} else if (typeof spec.content === "object"){
				for (var key in spec.content) {
					var value = spec.content[key] || "";
					// 
					var key_spec = key.split(".");
					var tag_name = key_spec.shift(); // first item is tag name.
					var child_element;
					in_production_try(this,
						function () {
							child_element = $(document.createElement(tag_name));
						},
						function () {
							child_element = $(document.createElement("div"));
						}
					);
					this.card_front.append(child_element);
					if (key_spec.length) {
						child_element.addClass(key_spec.join(" "));
					}
					child_element.html(value);
				}
			}
		},
		function () {
			spec = { content: { "div":"card spec fail." } };
		}
	);
	
	// how to proceed from this card onward. Is it 'modal'? 
	if ((spec.okClick || false) && (typeof spec.okClick === "function")) {
		this.addOKButton(spec);
	} else if (spec.timeout || false) {
		// hold on the card for some predetermined time.
		if ((game.current_round.transition) && (typeof game.current_round.transition === "function")) {
			setTimeout(game.current_round.transition.bind(game), spec.timeout || Card.DEFAULTS.timeout);
		}
		// else, just leave the card up indefinitely.
	}
}

Game.Card.prototype.addOKButton = function (spec) {
	// once the user clicks to continue, we can move onto the game.
	// for now, we"re going to stick to the notion that all intros require a click to continue.
	var card = this;
	var onclick_handler = spec.okClick
	var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function () {
		card.element.remove();
		setTimeout(function () { onclick_handler.call(); }, 500); // pause before triggering animations?
	});
	ok_button.appendTo(this.card_front);
};

Game.Card.prototype.deal = function () {
	if (this.container === Game){
		this.container = window.game.container;
	}
	$(this.container).append(this.element);
}

Game.Card.create = function (spec) {
	var card_class = spec["klass"] || "Card";
	var card = new Game[card_class](spec);
	card.populate();
	return card;
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
		if ( widget.hasOwnProperty("card") 
			&& (widget.card.hasOwnProperty("deal"))
			&& (typeof widget.card.deal === "function") ) {
			widget.card.deal();
		}
	});
}
Responder.prototype.respond = function (answer) {
	var feedback_spec = answer["feedback"] || [];
	if (typeof feedback_spec === "string") {
		feedback_spec = [{ content: feedback_spec }];
	} else if (feedback_spec.constructor !== Array) {
		feedback_spec = [feedback_spec];
	}
	var feedback_types = $.map(feedback_spec, function () {
		return this["feedback_type"] || Feedback.DEFAULTS.Type;
	});
	var feedback = new Feedback(feedback_types, this, answer);
	// move on immediately to the state of evaluating responses. 
	// don't defer(), as one of multiple widgets could've triggered this, and we need to get out of this state, pronto.
	this.round.respond(feedback);
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
 * Each response widget should return an Answer object. This comes from the YAML spec for this Round.
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
	$.each(this.answers, function (i, answer_spec) {
		var answer = new Answer(answer_spec);
		var btn_id = "radio_btn_" + widget.round.nbr + "_" + (i + 1);
		widget.radio_btns[btn_id] = 
			{ html: ("<input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + btn_id + "\">" + answer.content + "</label></input>"),
			  answer: answer
			}
	});
	var content = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
		return btn.html;
	}).join("\n");
	var card = Game.Card.create(content);
	var default_deal = card.deal;
	card.deal = function () {
		card.element.find("input[type=radio]").on("click", function(e) {
			var clicked_radio_btn = widget.radio_btns[e.target.id];
			var correct = clicked_radio_btn.answer.correct || false;
			var value = clicked_radio_btn.answer.value || 1;
			var neg_value = clicked_radio_btn.answer.negative_value || 0; // any penalty for answering incorrectly?
			widget.score += correct ? value : neg_value;
			var answer = new Answer(clicked_radio_btn.answer);
			widget.responder.respond(answer);
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
		content: { "form": "<input type=\"text\" />" }
	}
	var card = Game.Card.create(card_spec);
	var default_deal = card.deal;
	var widget = this;
	card.deal = function () {
		card.element.find("input[type=text]").on("keypress", function(e) {
	        if (e.keyCode === 13) {
				var answer = new Answer(e.target.value);
				widget.responder.respond(answer);
			}
		});
		default_deal.apply(card);
		card.element.find("input[type=text]").focus();
	}
	return card;
}
ResponseWidgetFactory.FreeResponse.prototype.getScore = function() {
	// any response is fine by default in FreeResponse (eg; getting user's name).
	/*** need to create a ScoredTextResponse, with correctness function passed via YAML. ***/
	return 1;
}



/* 
 * Answer
 * Answers are how the user's actions are communicated to the program. 
 * Answers should provide ??
 */
function Answer(spec) {
	if (typeof spec === "string") {
		spec = { content: spec };
	}
	$.extend(this, spec);
}



/* 
 * Feedback
 * Default Feedback is just to deal a card with some text or HTML on it.
 * Similar method for getting Responses from the user: option for multiple widgets.
 * Should really focus on allowing many feeback types & also allowing logic for custom feedback.
 * Feedback objects just need a constructor and a give() method.
 */
function Feedback(feedback_types, responder, answer) {
	Feedback.DEFAULTS = {
		Type: "Simple"
	}
	this.responder = responder;
	this.answer = answer;
	var _this = this;
	this.widgets = $.map(feedback_types, function(feedback_type) {
		return FeedbackWidgetFactory.create([feedback_type || Feedback.DEFAULTS.Type], _this);
	});
}
Feedback.prototype.give = function () {
	// all widgets get the giveFeedback() command simulatenously, but a widget's giveFeedback()
	// might just enable it or put it into 'play' in some way (like an additional reward, barrier, or character).
	var _this = this;
	var rtn_val = false;
	$.each(this.widgets, function (i, widget) {
		rtn_val = rtn_val || widget.giveFeedback(_this.answer);
	});
	return rtn_val;
}

FeedbackWidgetFactory = {};

FeedbackWidgetFactory.create = function (feedback_type, feedback_obj) {
	if (!FeedbackWidgetFactory.hasOwnProperty(feedback_type)) {
		console.log("Warning: Cannot find FeedbackWidgetFactory." + feedback_type);
		return;
	}
	// as with ResponseWidgets, we use Cards to convey messages.
	// again, someday these could come from synchronous communication between users.
	var widget;
	in_production_try(this,
		function () {
			// create widget and attach my feedback_obj. ask widget to create a Card.
			widget = new FeedbackWidgetFactory[feedback_type](feedback_obj);
			// ensure that responder gets set.
			if (!widget.hasOwnProperty("feedback_obj")) {
				widget["feedback_obj"] = feedback_obj; 
			}
		}
	);
	return widget;
}

FeedbackWidgetFactory.Simple = function () {}
FeedbackWidgetFactory.Simple.prototype.giveFeedback = function(answer) {
	var feedback_card = this.getCard(answer.feedback)
	feedback_card.deal();
	return feedback_card;
}
FeedbackWidgetFactory.Simple.prototype.getCard = function(feedback_spec) {
	if (typeof feedback_spec === "string") {
		feedback_spec = { content: { "div": feedback_spec } };
	}
	var card_spec = {
		content: feedback_spec.content
	}
	var card = Game.Card.create(card_spec);
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
CountdownClock.prototype.reset = function () {
	this.stop();
	this.clock_face.val(null);
}


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