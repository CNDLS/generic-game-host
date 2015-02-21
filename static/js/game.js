/******************************************************************************
 * Generic Game Engine
 * Copyright (c) 2014-2015 Bill Garr and CNDLS, Georgetown University -- https://github.com/CNDLS/generic-game-host
 * Released under Creative Commons license -- http://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * VERSION 0.1.0
 * (release notes to go here).
 ******************************************************************************/

var environment = { mode: "development" };

/* 
 * Game.
 * This object is responsible for 
 *
 * The Game object gets created upon successful loading of a YAML file from the server. 
 * Details of that could differ between implementations, so we leave all of that to the host app.
 * Look for a bootstrapping script in the page that hosts this file.
 */
function Game(game_spec, report_url, csrftoken) {
	this.spec = game_spec;
	
	this.current_round = undefined;
	this.round_nbr = 0;
	this.element = $("#game");
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.internal_clock = this.read("InternalClock"); // alt InternalClock eg; main GodotEngine scene.
	this.display_clock = this.read("DisplayClock"); // eg; a countdown clock.
	this.scoreboard = this.read("ScoreBoard");
	this.dealer = this.read("Dealer"); // generic Dealer just for Intro or other notifications from the Game.
	this.reporter = this.read("Reporter");
	this.winning_score = this.read("WinningScore");
	this.current_score = 0;
										
	// load any resources that may be available to the user throughout the game.
	// later, build in a concept of returning to a saved game, and restoring the
	// current state of these resources.
	this.global_resources = this.read("Resources");
	
	// set up the reporter with the url & csrf token passed in from play.html
	this.reporter.setURL(report_url, csrftoken);

	// record the time the game was started.
	this.record({ event: "start of game" });
	
	// start the game. 
	// later, we will omit this step if user is returning to a saved game.
	this.internal_clock.start();
	this.introduce();
}

/* 
 * constants for Game.
 */
Game.DEFAULTS = {
	Title: "Generic Game",
	InternalClock: "InternalClock",
	DisplayClock: "NullClock",
	ScoreBoard: "ScoreBoard",
	Reporter: "Reporter",
	Dealer: "Dealer",
	Rounds: [],
	Utilities: {},
	Intro: "Welcome to the game!",
	Resources: {},
	WinningScore: 1,
	WonGameFeedback: "<h3>Hey, you won!</h3>",
	LostGameFeedback: "<h3>That didn't work out so well; you lost. Better luck next time!</h3>"
};

Game.prototype.nextTick = function () {
	return this.internal_clock.nextTick();
}

Game.prototype.record = function (data) {
	// write out the user data.
	this.reporter.addData(data);
}

Game.prototype.report = function (create_round, catch_func) {
	this.reporter.sendReport().then(function () {
		in_production_try(this, create_round, catch_func);
	});
}

Game.prototype.introduce = function () {
	// introduce any explanatory note.
	var intro_spec = this.read("Intro");
	if (typeof intro_spec === "string"){
		intro_spec = { content: intro_spec };
	}
	// by default, use Game.Card.Modal to define the card.
	intro_spec = $.extend({ klass: "Modal" }, intro_spec);
	
	// deliver just the intro card. we will require a click-through on this card.
	var intro_card = this.dealer.dealOneCard(intro_spec);
	$.when( intro_card.dfd ).then(this.newRound.bind(this));
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
	var defaults = this.constructor.DEFAULTS || {};
	if (rtn_val === undefined && (typeof defaults[fieldName] !== "undefined")) {
		rtn_val = defaults[fieldName];
	}
	if (rtn_val === undefined) {
		console.log("Cannot provide a '" + fieldName + "' from Game spec or defaults.");
	}
	// if rtn_val is the name of something that is defined on the Game, Game.Round, etc. object, use that.
	if (this.constructor.hasOwnProperty(rtn_val)) {
		rtn_val = this.constructor[rtn_val];
	}
	// if rtn_val is a function, instantiate it, passing in the Game object.
	if (typeof rtn_val === "function") { rtn_val = new rtn_val(this); }
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
	var game = this;
	this.report(
		function create_round() {
			if (game.rounds.count() > game.round_nbr) {
				++game.round_nbr;
				// NOTE: have to use get(), rather than array index ([]),
				// so we can trigger !do statements, if there are any.
				game.current_round = new Game.Round(game, game.rounds.get(game.round_nbr - 1));
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