/* 
 * Displays are persistent outputs to the player,
 * indicating score, time remaining, and other information
 * that should persist across Rounds.
 * Perhaps they should also deal Cards?
 */

/* 
 * Game.CountdownClock
 * This is a default onscreen (External) clock -- it just puts numbers into a field, counting down from max_time for the Round.
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