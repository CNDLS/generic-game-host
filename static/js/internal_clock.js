/* 
 * Internal Clocks control playback of the game. They queue up any requests for state changes,
 * and they insure that only the first-queued request gets implemented.
 * Internal Clocks could also provide us with a way of integrating with animation and/or game libraries.
 *

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
	setInterval(this.tick.bind(this), 5);
}

Game.InternalClock.prototype.clearQueue = function () {
	this.queue = [];
}

Game.InternalClock.prototype.addToQueue = function (f) {
	if (this.queue === undefined) { this.clearQueue(); }
	if (typeof f === "function") { this.queue.push(f); }
}

Game.InternalClock.prototype.tick = function () {
	var state = (this.game.current_round) ? this.game.current_round.current : undefined;
	var _this = this;
	$.each(this.queue, function (i, fn) {
		if (typeof fn === "function") { 
			fn.call();
		} else {
			// remove non-functions from the queue.
			_this.queue.splice(i, 1);
		}
		// if any queue item causes a change of state,
		// flush the rest of the queue (so we don't process multiple state change req's).
		if ( _this.game.current_round && (_this.game.current_round.current !== state) ) {
			_this.clearQueue();
		}
	});
	this.clearQueue();
}


/* 
 * Game.ProcessingClock
 * This type of InternalClock is just a modification of Game.InternalClock,
 * which relies on the processing.draw function for its ticks. (60x per second, so ~16.6 ticks, instead of our default 5).
 * we have to pass the processing object to the start() call..?
 */
Game.ProcessingClock = function (game) { 
	this.game = game;
}
$.extend(Game.ProcessingClock.prototype, Game.InternalClock);

Game.ProcessingClock.prototype.start = function () {
	this.clearQueue();
	
	var tick_proc = Game.InternalClock.prototype.tick.bind(this);
	var ticker = function (processing) { 
		processing.draw = function () { tick_proc.call(); }
	}
	// create a canvas element in the Game for Processing to operate within.
	var game_canvas;
	try {
		game_canvas = $('<canvas/>', { 'class':'game-canvas' }).width(game.element.width()).height(game.element.height()).get(0);
		this.processing = new Processing(game_canvas, ticker);
	} catch (e) {
		console.warn("Could not link tick function to Processing::draw(). Default clock will be used.");
	}
}