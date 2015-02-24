/* 
 * Widgets are persistent controls/displays indicating
 * score, time remaining, or providing access to an inventory of assets
 * that should persist across Rounds.
 */
Game.Widgets = {};

/* 
 * Game.Widgets.CountdownClock
 * This onscreen (External) clock just puts numbers into a field, counting down from max_time for the Round.
 * Custom clocks need to expose start(max_time), stop(), and a tick() function, which should return the current time.
 */
Game.Widgets.CountdownClock = function (game) {
	this.game = game;
	this.clock_face = $("textarea#clock");
};

Game.Widgets.CountdownClock.prototype.start = function (max_time) {
	clearInterval(this.clock);
	this.clock = setInterval(this.tick.bind(this), 1000);
	this.clock_face.val(max_time);
};

Game.Widgets.CountdownClock.prototype.tick = function () {
	var current_time = this.clock_face.val() - 1;
	this.clock_face.val(current_time);
	if (current_time === 0) { 
		this.stop();
		game.timeoutRound(); 
	}
	return current_time;
};

Game.Widgets.CountdownClock.prototype.stop = function () {
	clearInterval(this.clock);
};

Game.Widgets.CountdownClock.prototype.reset = function () {
	this.stop();
	this.clock_face.val(null);
};


/* 
 * Game.Widgets.NullClock
 * If you don't want an onscreen clock, this will just fulfill the Clock commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.Widgets.NullClock = function () {};
Game.Widgets.NullClock.prototype.init = function (game) {};
Game.Widgets.NullClock.prototype.start = function (max_time) {};
Game.Widgets.NullClock.prototype.tick = function () { return undefined; };
Game.Widgets.NullClock.prototype.stop = function () {};



/* 
 * Game.Widgets.Scoreboard
 * This is a default scoreboard -- it displays the current score in a field.
 * Custom scoreboards need to expose init(game), add(points), subtract(points), and a reset() functions.
 */
Game.Widgets.Scoreboard = function (game) {
	this.display = $("<textarea id=\"scoreboard\" readonly></textarea>");
	$("#widgets").append(this.display);
	this.game = game;
	this.points = game.current_score;
	this.refresh();
	
	// listen for addPoints events from the game.
	$(document).on("game.addPoints", this.add.bind(this));
};

Game.Widgets.Scoreboard.prototype.add = function (e, points) {
	this.points += points;
	this.refresh();
	return this.points;
};

Game.Widgets.Scoreboard.prototype.subtract = function (points) {
	this.points -= points;
	this.refresh();
	return this.points;
};

Game.Widgets.Scoreboard.prototype.reset = function () {
	this.points = 0;
	this.refresh();
	return this.points;
};

Game.Widgets.Scoreboard.prototype.refresh = function () {
	// fold in any special message, then display.
	var addPointsMessage = this.game.read("AddPoints") || ":points";
	addPointsMessage = addPointsMessage.insert_values(this.points);
	this.display.val(addPointsMessage);
};


/* 
 * Game.Widgets.NullScoreboard
 * If you don't want a scoreboard, this will just fulfill the Scoreboard commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.Widgets.NullScoreboard = function () {};
Game.Widgets.NullScoreboard.prototype.init = function (game) {};
Game.Widgets.NullScoreboard.prototype.add = function (points) {};
Game.Widgets.NullScoreboard.prototype.subtract = function (points) {};
Game.Widgets.NullScoreboard.prototype.reset = function () {};
Game.Widgets.NullScoreboard.prototype.refresh = function () {};