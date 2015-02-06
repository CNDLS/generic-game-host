/******************************************************************************
 * Generic Game Engine
 * Copyright (c) 2014-2015 Bill Garr and CNDLS, Georgetown University -- https://github.com/CNDLS/generic-game-host
 * Released under Creative Commons license -- http://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * VERSION 0.1.0
 * (release notes to go here).
 ******************************************************************************/

var game;
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
	
	this.current_round = undefined;
	this.round_nbr = 0;
	this.container = $("#game");
	this.title = $("#title").html(this.read("Title"));
	this.rounds = this.read("Rounds"); // the rounds of the game.
	this.internal_clock = this.read("InternalClock"); // alt InternalClock eg; main GodotEngine scene.
	this.external_clock = this.read("ExternalClock");
	this.scoreboard = this.read("ScoreBoard");
	this.reporter = this.read("Reporter");
	this.winning_score = this.read("WinningScore");
	this.current_score = 0;
										
	// load any resources that may be available to the user throughout the game.
	// later, build in a concept of returning to a saved game, and restoring the
	// current state of these resources.
	this.global_resources = this.read("Resources");

	// record the time the game was started.
	this.record({ event: "start of game" });
	
	// start the game. 
	// later, we will omit this step if user is returning to a saved game.
	this.introduce();
}

/* 
 * constants for Game.
 */
Game.DEFAULTS = {
	Title: "Generic Game",
	InternalClock: "InternalClock",
	ExternalClock: "NullClock",
	ScoreBoard: "ScoreBoard",
	Reporter: "Reporter",
	Rounds: [],
	Utilities: {},
	Intro: "Welcome to the game!",
	Resources: {},
	WinningScore: 1,
	WonGameFeedback: "<h3>Hey, you won!</h3>",
	LostGameFeedback: "<h3>That didn't work out so well; you lost. Better luck next time!</h3>"
};


Game.prototype.defer = function (f, context) {
	f = f.bind(context || this.current_round || this);
	this.internal_clock.addToQueue(f);
}


Game.prototype.record = function (data) {
	// write out the user data.
	this.reporter.addData(data);
}

Game.prototype.report = function (report_round, catch_func) {
	this.reporter.sendReport(function () {
		in_production_try(this, report_round, catch_func);
	});
}


Game.prototype.introduce = function () {
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
	if (rtn_val === undefined && (typeof Game.DEFAULTS[fieldName] !== "undefined")) {
		// defaults that are functions are defined as members of the Game function.
		var game_default = Game.DEFAULTS[fieldName];
		if (Game.hasOwnProperty(game_default)) {
			rtn_val = Game[game_default];
		} else {
			rtn_val = game_default;
		}
	}
	if (rtn_val === undefined) {
		console.log("Cannot provide a '" + fieldName + "' from Game spec or defaults.");
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
		function report_round() {
			if (game.rounds.count() > game.round_nbr) {
				++game.round_nbr;
				// NOTE: have to use get(), rather than array index ([]),
				// so we can trigger !evaluate, if need be.
				game.current_round = new Game.Round(game.rounds.get(game.round_nbr - 1));
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
 * Game.InternalClock
 * The InternalClock is responsible for collecting defer()'ed commands in a queue. Once a state transition happens,
 * the InternalClock will flush its queue. This prevents the possibility of a second state change being triggered 
 * before the first one can complete. (State changes should always happen outside of the current calling chain).
 */
Game.InternalClock = function (game) {
	this.game = game;
}

Game.InternalClock.prototype.start = function () {
	this.clearQueue();
	setTimeout(this.tick.bind(this), 5);
}

Game.InternalClock.prototype.clearQueue = function () {
	this.queue = [];
}

Game.InternalClock.prototype.addToQueue = function (f) {
	if (typeof f === "function") { this.queue.push(f); }
}

Game.InternalClock.prototype.tick = function () {
	// hold the clock between rounds -- no state machine exists at that point!
	if (!this.game.current_round) return;
	var state = this.game.current();
	$.each(this.queue, function (i) {
		if (typeof this === "function") { 
			this.call();
		} else {
			// remove non-functions from the queue.
			this.queue.splice(i, 1);
		}
		// if any queue item causes a change of state,
		// flush the rest of the queue (so we don't process multiple state change req's).
		if (this.game.current_round.current() !== state) {
			this.clearQueue();
		}
	});
	this.clearQueue();
}


/* 
 * Game.CountdownClock
 * This is a default onscreen clock -- it just puts numbers into a field, counting down from max_time for the Round.
 * Custom clocks need to expose start(max_time), stop(), and a tick() function, which should return the current time.
 */
Game.CountdownClock = function (game) {
	this.game = game;
	this.clock_face = $("textarea#clock");
};

Game.CountdownClock.prototype.start = function (max_time) {
	clearInterval(this.clock);
	this.clock = setInterval(this.tick.bind(this), 1000);
	this.clock_face.val(max_time);
};

Game.CountdownClock.prototype.tick = function () {
	var current_time = this.clock_face.val() - 1;
	this.clock_face.val(current_time);
	if (current_time === 0) { 
		this.stop();
		game.timeoutRound(); 
	}
	return current_time;
};

Game.CountdownClock.prototype.stop = function () {
	clearInterval(this.clock);
};

Game.CountdownClock.prototype.reset = function () {
	this.stop();
	this.clock_face.val(null);
};


/* 
 * Game.NullClock
 * If you don't want an onscreen clock, this will just fulfill the Clock commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.NullClock = function () {};
Game.NullClock.prototype.init = function (game) {};
Game.NullClock.prototype.start = function (max_time) {};
Game.NullClock.prototype.tick = function () { return undefined; };
Game.NullClock.prototype.stop = function () {};



/* 
 * Game.ScoreBoard
 * This is a default scoreboard -- it displays the current score in a field.
 * Custom scoreboards need to expose init(game), add(points), subtract(points), and a reset() functions.
 */
Game.ScoreBoard = function (game) {
	this.display = $("textarea#scoreboard");
	this.game = game;
	this.points = game.current_score;
	this.refresh();
};

Game.ScoreBoard.prototype.add = function (points) {
	this.points += points;
	this.refresh();
	return this.points;
};

Game.ScoreBoard.prototype.subtract = function (points) {
	this.points -= points;
	this.refresh();
	return this.points;
};

Game.ScoreBoard.prototype.reset = function () {
	this.points = 0;
	this.refresh();
	return this.points;
};

Game.ScoreBoard.prototype.refresh = function () {
	// fold in any special message, then display.
	var addPointsMessage = this.game.read("AddPoints") || ":points";
	addPointsMessage = addPointsMessage.insert_values(this.points);
	this.display.val(addPointsMessage);
};


/* 
 * Game.NullScoreBoard
 * If you don't want a scoreboard, this will just fulfill the ScoreBoard commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.NullScoreBoard = function () {};
Game.NullScoreBoard.prototype.init = function (game) {};
Game.NullScoreBoard.prototype.add = function (points) {};
Game.NullScoreBoard.prototype.subtract = function (points) {};
Game.NullScoreBoard.prototype.reset = function () {};
Game.NullScoreBoard.prototype.refresh = function () {};