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
	this.container = this.read("Container");
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.internal_clock = this.read("InternalClock"); // alt InternalClock eg; main GodotEngine scene.
	this.dealer = this.read("Dealer"); // generic Dealer just for Intro or other notifications from the Game.
	this.reporter = this.read("Reporter");
	this.winning_score = this.read("WinningScore");
	this.current_score = 0;

	var game = this;
	
	// load any HTML to define the Scene(s) in which the game will take place.
	// we'll rely on css to set initial positions of objects,
	// and any scene should be referencable by any rendering library we attach to.
	// A Scene is just another Card.
	var scene_specs = this.read("Scenes");
	this.scenes = $.collect(scene_specs, function (i){
		var ith_scene = Game.SceneFactory.create(this, game);
		ith_scene.init();
		return ith_scene;
	});
										
	// load any resources that may be available to the user throughout the game.
	// later, build in a concept of returning to a saved game, and restoring the
	// current state of these resources.
	this.global_resources = this.read("Resources");
	
	// display any widgets that will remain available throughout the game.
	// eg; a countdown clock, scoreboard, etc.
	var widget_specs = this.read("Widgets");
	this.widgets = $.each(widget_specs, function (i, widget_type_name){
		return new Game.Widgets[widget_type_name](game);
	});
	
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
	Container: $("#game"),
	InternalClock: "InternalClock",
	Scenes: [],
	Widgets: [],
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
	intro_spec = $.extend({ type: "Modal" }, intro_spec);
	
	// deliver just the intro card. we will require a click-through on this card.
	var intro_card = this.dealer.dealOneCard(intro_spec);
	$.when( intro_card.dfd ).then(this.newRound.bind(this));
};

Game.prototype.timeoutRound = function () {
	this.current_round.timeout();
};

Game.prototype.addPoints = function (points) {
	this.current_score += points;
	$.event.trigger("game.addPoints", [points]);
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
	feedback_card.dealTo();
	// add to the msg stream as well.
	this.sendMessage(gameFeedbackMessage);
};

Game.prototype.read = function (field_name /* , default_value */ ) {
	if (!this.hasOwnProperty("spec")) { 
		console.warn("YAML spec not defined for read().");
		return undefined;
	}
	// provide a number of ways to define objects through the spec. 
	// but keep them simple and like natural language.
	// fall back to defaults defined on Game or Game.Round,
	// whoever is calling this.
	var default_value = arguments[1] || undefined;
	var rtn_val = this.spec.get(field_name);
	// first, try falling back to a passed-in return value.
	if (rtn_val === undefined && (typeof default_value !== "undefined")) { rtn_val = default_value; }
	// then, check the defaults for the Game or Game.Round.
	var defaults = this.constructor.DEFAULTS || {};
	if (rtn_val === undefined && (typeof defaults[field_name] !== "undefined")) {
		rtn_val = defaults[field_name];
	}
	if (rtn_val === undefined) {
		console.log("Cannot provide a '" + field_name + "' from Game spec or defaults.");
	}
	// if rtn_val is the name of something that is defined on the Game, Game.Round, etc. object, use that.
	if (this.constructor.hasOwnProperty(rtn_val)) {
		rtn_val = this.constructor[rtn_val];
	} else if ((rtn_val instanceof YAML) 
				&& this.constructor.hasOwnProperty(field_name)
				&& typeof this.constructor[field_name] === "function") {
		// if it is YAML for something that can be created on the Game or Game.Round, create the object for it.
		// (eg; field_name is "Prompter").
		rtn_val = new this.constructor[field_name](this, rtn_val);
	}
	// if rtn_val is a function, instantiate it, passing in the Game object.
	if (typeof rtn_val === "function") { 
		rtn_val = new rtn_val(this); 
	}
	return rtn_val;
};

Game.prototype.sendMessage = function (msgText) {
	console.log(" - " + msgText);
};

Game.prototype.allowReplay = function () {
	$("#top .replay").show();
};

Game.prototype.newRound = function (next_round) {
	// do reporting here.
	// only advance upon successfully reporting progress.
	// if there's a communications failure, we'll at least know when it happened.
	var game = this;
	var game_is_over = ((this.round_nbr >= this.rounds.length) && !next_round);
	this.report(
		function create_round() {
			if (game_is_over) {
				game.gameFeedback();
				game.allowReplay();
			} else {
				if (next_round instanceof YAML) {
					game.current_round = new Game.Round(game, next_round);
					game.round_nbr = game.rounds.indexOf(next_round) + 1;
				} else {
					++game.round_nbr;
					game.current_round = new Game.Round(game, game.rounds.get(game.round_nbr - 1));
				}
				$.event.trigger("Game.newRound", { round: game.current_round });
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