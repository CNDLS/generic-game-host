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
function Game(game_spec) {
	this.spec = game_spec;
	
	this.current_round;
	this.round_nbr = 0;
	this.prior_round_nbr = 0;
	this.container = this.read("Container");
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.internal_clock = this.read("InternalClock"); // alt InternalClock eg; main GodotEngine scene.
	this.reporter = this.read("Reporter");
	
	// either a winning_score or a winning() function must be provided.
	this.winning_score = this.read("WinningScore");
	if (this.winning_score === undefined) {
		this.winning = this.read("Winning");
		if (typeof this.winning != "function") {
			throw new Error("YAML must specify either a winning score or a winning() function.");
		}
	}
	this.current_score = 0;

	var game = this;

	// A Scene is made of Cards.
	// load any HTML to define the Scene(s) in which the game will take place.
	// Create an object that associates Scenes with the Rounds in which they appear.
	var scene_specs = this.read("Scenes");
	this.scenes = {};
	$(scene_specs).each(function (i){
		var ith_scene = Game.SceneFactory.create(this, game, Game.Round.Events);
		$(ith_scene.rounds).each(function () {
			game.scenes[Math.round(this)] = ith_scene;
		})
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
	IntroDealer: "Dealer",
	Rounds: [],
	Utilities: {},
	Intro: "Welcome to the game!",
	Resources: {},
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
	// changed create_round call from .then() to .done(), 
	// so the game won't pause if AJAX fails.
	// hopefully, we'll get the data sent at the next opportunity.
	this.reporter.sendReport().done(function () {
		in_production_try(this, create_round, catch_func);
	});
}

Game.prototype.introduce = function () {
	this.intro_dealer = this.read("IntroDealer");
	
	// introduce any explanatory note.
	var intro_specs = this.read("Intro");
	if (!intro_specs instanceof Array) {
		intro_specs = [intro_specs];
	}
	
	// make sure our intro_specs fit requirements.
	var _this = this;
	var intro_cards = $.collect(intro_specs, function () {
		var intro_spec = this;
		if (typeof intro_spec === "string"){
			intro_spec = { content: intro_spec };
		}
		// by default, use Game.Card.Modal to define the card.
		intro_spec = $.extend({ type: "Modal" }, intro_spec);
		return _this.intro_dealer.addCard(intro_spec);
	});
	
	// we'll need to wait for user input. 
	// each card should know what it needs to wait for before we can move on.
	var user_input_promises = $.collect(intro_cards, function () {
		return this.user_input_promise || null;
	});
	
	// deliver just the intro cards. 
	// the default IntroDealer will deal the Cards, one at-a-time, requiring click-through on each.
	this.intro_dealer.deal(intro_cards);
	
	// when all user_input_promises are fulfilled, move on.
	$.when.apply($, user_input_promises).then(function () {
		_this.newRound();
	});
};

Game.prototype.timeoutRound = function () {
	this.current_round.timeout();
};

Game.prototype.addPoints = function (points) {
	this.current_score += points;
	$.event.trigger("game.addPoints", [points]);
};

Game.prototype.setPoints = function (points) {
	this.current_score = points;
	$.event.trigger("game.setPoints", [points]);
};

Game.prototype.checkIfUserWon = function () {
	this.user_won = false;
	if (Util.isNumeric(this.winning_score) && (this.current_score >= this.winning_score)) {
		this.user_won = true;
	} else if ((typeof this.winning === "function") && (this.winning() === true)) {
		this.user_won = true;
	}
}

Game.prototype.gameFeedback = function () {
	var gameFeedbackMessage;
	if (this.user_won) {
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
	feedback_card.dealTo(feedback_spec.container);
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
		// console.log("Cannot provide a '" + field_name + "' from Game spec or defaults.");
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
	// advance to next round upon successfully reporting progress.
	// if there's a communications failure, we'll at least know when it happened.
	var game = this;
	var game_is_over = ((this.round_nbr >= this.rounds.length) && !next_round) || (next_round === -1);

	this.checkIfUserWon();
	game_is_over = game_is_over || this.user_won;
	
	this.report(
		function create_round() {
			if (game_is_over) {
				game.end();
			} else {
				game.prior_round_nbr = game.round_nbr;
				
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
			game.end();
		}
	);
};

Game.prototype.end = function() {
	$.event.trigger("game.resetClock");
	if (this.current_round) this.current_round.doTearDown();
	this.gameFeedback();
	this.allowReplay();
}

Game.prototype.abort = function() {
	// this is our way of cleaning up following a fatal error.
	// nothing to do here in a generic way, but maybe we'll want the option of a game tearDown()?
}


/* 
 * CREATING SCOPES ON GAME OBJECT (or other object bound to this function).
 * Allows for syntax where a 'bag of functions' refines an existing object.
 * For example, this is used in demo.js to create a Game.Scene.Gorge object that is easy to read.
 * ancestry goes subclass -> metaclass -> superclass.
 */
Game.new = function (superclass, scope_name, fn_or_obj, obj) {
	"use strict";
	var subclass;
	
	if (typeof fn_or_obj === "function") {
		subclass = fn_or_obj;
	} else {
		// create a function to hold all the properties in obj.
		subclass = function () {
			return superclass.prototype.constructor.apply(this, arguments);
		};
		obj = fn_or_obj;
	}
	subclass.prototype = Util.extend(subclass, superclass);
	$.extend(subclass.prototype, obj);
	this[scope_name] = subclass;
	return subclass;
}


/*
 *  BOOTSTRAPPING THE GAME OBJECT. 
 *  Reads URL of YAML file from a <SCRIPT> tag attribute & uses it to create a Game object.
 *  By default, we just put the game into a variable on the window scope. some implementations might want something different: multiple games, maybe?
 */
$(function () {
	var read_url = $("script#reader").attr("read-from");
	var report_url = $("script#reporter").attr("report-to");
	var csrftoken = $("script#reporter").attr("csrftoken");
          var parsed_yaml;
	// get the YAML from our URL.
	$.ajax({
		url: read_url,
		type: "GET",
		success: function (data /* , textStatus, XMLHttpRequest */) {
			// try to parse the game data.
			in_production_try(this,
				function () {
					// try to make a game from the parsed game data.
					parsed_yaml = new YAML( jsyaml.safeLoad(data, { schema: GAME_SCHEMA }) );
				}
			);
                  
                  if (parsed_yaml) {
				game = new Game(parsed_yaml);
                      game.reporter.setURL(report_url, csrftoken);
                  }
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.error(XMLHttpRequest, textStatus, errorThrown);
		}
	});
});