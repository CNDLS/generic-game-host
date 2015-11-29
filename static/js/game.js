/******************************************************************************
 * Generic Game Engine
 * Copyright (c) 2014-2015 Bill Garr and CNDLS, Georgetown University -- https://github.com/CNDLS/generic-game-host
 * Released under Creative Commons license -- http://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * VERSION 0.1.0
 * (release notes to go here).
 ******************************************************************************/

var environment = { mode: "development", verbose: false };

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
	this.scenes = [];
	$(scene_specs).each(function (i) {
		var ith_scene = Game.SceneFactory.create(game, this, Game.Round.Events);
		game.scenes.push(ith_scene);
	});
		
	// load any resources that may be available to the user throughout the game.
	// later, build in a concept of returning to a saved game, and restoring the
	// current state of these resources.
	this.global_resources = this.read("Resources");
	
	// display any widgets that will remain available throughout the game.
	// eg; a countdown clock, scoreboard, etc.
  this.widgets_container = this.read("WidgetsContainer");
	var widget_specs = this.read("Widgets");
	this.widgets = [];
  $.each(widget_specs, function (i) {
    var ith_widget = Game.WidgetFactory.create(game, this);
    game.widgets.push(ith_widget);
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
	WidgetsContainer: $("#widgets"),
	Reporter: "Reporter",
	IntroDealer: "IntroDealer",
	Rounds: [],
	Utilities: {},
	Intro: "Welcome to the game!",
	Resources: {},
	WonGameFeedback: "<h3>Hey, you won!</h3>",
	LostGameFeedback: "<h3>That didn't work out so well; you lost. Better luck next time!</h3>"
};


Game.prototype = $.extend(Game.prototype, {
  nextTick: function () {
  	return this.internal_clock.nextTick();
  },

  record: function (data) {
  	// write out the user data.
    if (this.reporter instanceof Game.Reporter) {
    	this.reporter.addData(data);
    } else {
      console.warn("No reporter to write out data:", data);
    }
  },

  report: function (try_func, catch_func) {
  	// changed create_round call from .then() to .done(), 
  	// so the game won't pause if AJAX fails.
  	// hopefully, we'll get the data sent at the next opportunity.
  	var _this = this;
  	this.reporter.sendReport().done(function () {
  		in_production_try(_this, try_func, catch_func);
  	});
  },

  introduce: function () {
  	this.intro_dealer = this.read("IntroDealer");
	
  	// introduce any explanatory note.
  	var intro_specs = this.read("Intro");
  	if (!(intro_specs instanceof YAML.Array)) {
  		intro_specs = [intro_specs];
  	}
	
  	// make sure our intro_specs fit requirements.
  	var _this = this;
  	var intro_cards = $.collect(intro_specs, function () {
  		var intro_spec = this;
  		if (typeof intro_spec === "string") {
  			intro_spec = { content: intro_spec };
  		} else if (intro_spec instanceof String) {
  		    intro_spec = { content: intro_spec.toString() };
  		}
  		// by default, use Game.Card.Modal to define the card.
  		// here, the default type "Modal" will be overwritten by any type in the intro_spec.
  		intro_spec = $.extend({ type: "Modal", css_class: "intro" }, intro_spec);
  		return _this.intro_dealer.addCard(intro_spec);
  	});
	
  	// the default IntroDealer will deal the Cards, one at-a-time, requiring click-through on each.
  	this.intro_dealer.introduce()
  	.then(function () {
  		_this.newRound();
  	});
  },

  timeoutRound: function () {
  	this.sendMessage("ran out of time.");
  	$.event.trigger("game.stopClock");
  	if (!this.current_round){ return; } // safety.
  	var timeout_fn = this.current_round.read("OnTimeout"); // default is giveWrongAnswer.
  	var timeout_obj = this.current_round[timeout_fn]();
  	this.current_round.respond(timeout_obj.answer, timeout_obj.score);
  },

  addPoints: function (points) {
  	this.current_score += points;
  	$.event.trigger("game.addPoints", [points]);
  },

  setPoints: function (points) {
  	this.current_score = points;
  	$.event.trigger("game.setPoints", [points]);
  },

  checkIfUserWon: function () {
  	this.user_won = false;
  	if (Util.isNumeric(this.winning_score) && (this.current_score >= this.winning_score)) {
  		this.user_won = true;
  	} else if ((typeof this.winning === "function") && (this.winning() === true)) {
  		this.user_won = true;
  	}
  },

  giveFinalFeedback: function () {
  	var gameFeedbackMessage;
  	this.checkIfUserWon();
  	if (this.user_won) {
  		gameFeedbackMessage = this.read("WonGameFeedback");
  	} else {
  		gameFeedbackMessage = this.read("LostGameFeedback");
  	}
  	// give opportunity to customize gameFeedbackMessage(s) with current score.
  	if (gameFeedbackMessage instanceof Array) {
  		gameFeedbackMessage = $(gameFeedbackMessage).collect(function () {
  			return this.insert_values(this.current_score);
  		});
  	} if (gameFeedbackMessage instanceof Object) {
  		for (var m in gameFeedbackMessage) {
  			gameFeedbackMessage[m] = gameFeedbackMessage[m].insert_values(this.current_score);
  		}
  	} else if (typeof gameFeedbackMessage === "string") {
  		gameFeedbackMessage = gameFeedbackMessage.insert_values(this.current_score);
  	}
	
  	var feedback_spec = {
  		content: gameFeedbackMessage,
  		css_class: "game_summary"
  	};
  	var feedback_card = Game.Card.create(feedback_spec);
  	feedback_card.dealTo(feedback_spec.container);
  	setTimeout(function () {
  		feedback_card.element.addClass("appear");
  	});
  },

  read: function (field_name /* , default_value */ ) {
  	if (!this.hasOwnProperty("spec")) { 
  		console.warn("YAML spec not defined for read().");
  		return undefined;
  	}
  	// provide a number of ways to define objects through the spec. 
  	// but keep them simple and like natural language.
  	// fall back to defaults defined on Game or Game.Round,
  	// whoever is calling this.
  	var default_value = arguments[1] || undefined;
  	var rtn_val = this.spec.get(field_name, this);
  	// first, try falling back to a passed-in return value.
  	if (rtn_val === undefined && (typeof default_value !== "undefined")) { rtn_val = default_value; }
  	// then, check the defaults for the Game or Game.Round.
  	var defaults = this.constructor.DEFAULTS || {};
  	if (rtn_val === undefined && (typeof defaults[field_name] !== "undefined")) {
  		rtn_val = defaults[field_name];
  	}
    // respond to different types of YAML rtn_val.
  	if (rtn_val instanceof YAML) {
      // if rtn_val specifies a type defined on the current object, construct one of that type.
      // eg; type: "DragAndDropListener" in a round spec yields a Game.Round.DragAndDropListener
  		if (rtn_val.hasOwnProperty("type") && Object.hasFunction(this, rtn_val.type)) {
  			// call constructor (value of type must be a function defined on this), and pass remaining values.
  			var rtn_val_constructor = this.constructor[rtn_val.type];
  			rtn_val = new rtn_val_constructor(this, rtn_val);
  		} else if (Object.hasFunction(this, field_name)) {
  			// if field_name specifies a type deFined on the curent object (usually Game or Game.Round),
        // create the object for it. (eg; field_name "Prompter" yields a Game.Round.Prompter).
  			rtn_val = new this.constructor[field_name](this, rtn_val);
  		} 
  	} else if (this.constructor.hasOwnProperty(rtn_val)) {
  		// if rtn_val is the name of something that is defined on the Game, Game.Round, etc. object, use that.
  		rtn_val = new this.constructor[rtn_val](this);
  	} 
  	// if rtn_val is a function (other than our enactSequence function), 
    // instantiate it, passing in the Game object.
  	if ((typeof rtn_val === "function") && (rtn_val.name !== "enactSequence")) {
  		rtn_val = new rtn_val(this); 
  	}

    // console.log(Game.getClassName(this) + "::" + field_name.underscore(), rtn_val);
  	return rtn_val;
  },

  sendMessage: function (msgText) {
  	console.log(" - " + msgText);
  },

  allowReplay: function () {
  	$("#top .replay").show();
  },

  newRound: function (next_round) {
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
  					game.round_nbr = game.rounds.indexOf(next_round) + 1;
  					game.current_round = new Game.Round(game, next_round);
  				} else {
  					++game.round_nbr;
  					game.current_round = new Game.Round(game, game.rounds.get(game.round_nbr - 1, game));
  				}
  				$.event.trigger("Game.newRound", { round: game.current_round });
  			}
  		}, 
  		function catch_func (e) {
  			game.end();
  		}
  	);
  },

  end: function() {
  	$.event.trigger("game.resetClock");
  	if (this.current_round) {
  		this.current_round.doTearDown();
  		this.current_round.scene.tearDown();
  	} 

  	// show the end msg after reporting is done.
  	var _this = this;
  	this.report(function () {
  		Game.clearCards();
  		_this.giveFinalFeedback();
  		_this.allowReplay();
  	}, $.noop);
  },

  abort: function() {
  	// this is our way of cleaning up following a fatal error.
  	// nothing to do here in a generic way, but maybe we'll want the option of a game tearDown()?
  }
});

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