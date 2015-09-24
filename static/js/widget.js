/* 
 * Widgets are persistent controls/displays indicating
 * score, time remaining, or providing access to an inventory of assets
 * that should persist across Rounds.
 */
Game.Widget = {};
Game.WidgetFactory = {};

Game.WidgetFactory.create = function (game, widget_spec) {
  var widget_type_name;
  try {
    if ((typeof widget_spec === "string") || (widget_spec instanceof String)) {
      widget_type_name = widget_spec.toString();
      return new Game.Widget[widget_type_name](game);
    } else if (typeof widget_spec === "object") {
      widget_type_name = Object.keys(widget_spec);
      widget_spec = widget_spec[widget_type_name]; // pass whatever params to constructor.
      return new Game.Widget[widget_type_name](game,widget_spec);
    } else {
      console.log("Could not create widget from " + widget_spec);
    }
  } catch (e) {
    console.log(e, widget_spec)
  }
}


/* 
 * Game.Widget.CountdownClock
 * This onscreen (External) clock just puts numbers into a field, counting down from max_time for the Round.
 * Custom clocks need to expose start(max_time), stop(), and a tick() function, which should return the current time.
 */
Game.Widget.CountdownClock = function (game, spec) {
  spec = spec || {};
  this.clock_card = new Game.Card("div#clock");
  this.clock_face = this.clock_card.element.render("span#clock_face");
  this.clock_backing = this.clock_card.element.render("svg#clock_backing[src=" + STATIC_URL + "img/clock.svg]");
  var clock_container = spec.container || game.widgets_container;
  // clock_container.render("svg[src=" + STATIC_URL + "img/clock.svg]");
  this.clock_card.dealTo(clock_container);
	
	this.game = game;
	// listen for startClock and stopClock events from the game.
	$(document).on("game.startClock", this.start.bind(this));
	$(document).on("game.stopClock", this.stop.bind(this));
	$(document).on("game.resetClock", this.reset.bind(this));
};

Game.Widget.CountdownClock.prototype.start = function (evt, max_time) {
	clearInterval(this.clock);
	if (typeof max_time === "number") {
		this.clock = setInterval(this.tick.bind(this), 1000);
		this.clock_face.html(max_time);
    this.max_time = max_time;
	}
};

Game.Widget.CountdownClock.prototype.tick = function () {
	var current_time = parseInt(this.clock_face.html()) - 1;
	this.clock_face.html(current_time);
	if (current_time === 0) { 
		this.stop();
		game.timeoutRound(); 
	}
  // cf. http://jsfiddle.net/lensco/ScURE/
  // get the svg cmds and separate out the part we'll change.
  this.clock_backing.find("path").attr("fill", "#CCCCCC");
  var path_cmds = this.clock_backing.find("path").attr("d");
  // eg, w/ groups: A(50), (50) (0) (0),1 86.44843137107057, 84.22735529643444
  // ERROR example: A50, 50 1, 0 1, 1, 1 51.82463258982846, 51.82463258982846, 187.63066800438637
  var elliptical_arc_regex = /A(\d+)\,\s?(\d+)\s(\d+)\s(\d+)\,\s?(\d+)\s(\d+\.*\d*)\,\s?(\d+\.*\d*)/;
  try {
    // pull out the part of the path that determines the 'pie' slice that is missing.
    var p = elliptical_arc_regex.exec(path_cmds).splice(1, 7);
  
    // redraw bg svg.
    var value = 100 * (this.max_time - current_time) / this.max_time;
    var x = Math.cos((2 * Math.PI)/(100/value));
  	var y = Math.sin((2 * Math.PI)/(100/value));
    
    if (value <= 0) {
      return; // done.
    }
  	//should the arc go the long way round?
  	var longArc = (value <= 50) ? 0 : 1;
    
    var new_path_cmds = ["A"];
    for (var i=0; i<p.length; i++) {
      switch (i) {
        case 0:
          new_path_cmds.push(p[i] + ", ");
          break;
          
        case 1:
          new_path_cmds.push(p[i] + " ");
          break;
          
        case 2:
          new_path_cmds.push(p[i] + " ");
          break;
          
        case 3:
          new_path_cmds.push(longArc + ", ");
          break;
          
        case 4:
          new_path_cmds.push(p[i] + " ");
          break;
          
        case 5:
          new_path_cmds.push(50 + y*50 + ", ");
          break;
          
        case 6:
          new_path_cmds.push(50 - x*50 + " ");
          break;
      }
    }
    path_cmds = path_cmds.replace(elliptical_arc_regex, new_path_cmds.join(""));
    this.clock_backing.find("path").attr("d", path_cmds);
    
  } catch (e) {
    debugger;
    // do nothing. it's just ornamentation.
  }
        
	return current_time;
};

Game.Widget.CountdownClock.prototype.stop = function (evt) {
	clearInterval(this.clock);
};

Game.Widget.CountdownClock.prototype.reset = function () {
	this.stop();
	this.clock_face.val(null);
};


/* 
 * Game.Widget.NullClock
 * If you don't want an onscreen clock, this will just fulfill the Clock commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.Widget.NullClock = function () {};
Game.Widget.NullClock.prototype.init = function (game) {};
Game.Widget.NullClock.prototype.start = function (max_time) {};
Game.Widget.NullClock.prototype.tick = function () { return undefined; };
Game.Widget.NullClock.prototype.stop = function () {};



/* 
 * Game.Widget.Scoreboard
 * This is a default scoreboard -- it displays the current score in a field.
 * Custom scoreboards need to expose init(game), add(points), subtract(points), and a reset() functions.
 */
Game.Widget.Scoreboard = function (game, spec) {
  spec = spec || {};
  this.display = new Game.Card("textarea#scoreboard[readonly=true]");
  this.display.dealTo(spec.container || game.widgets_container);
	
	this.game = game;
	this.points = game.current_score;
	this.refresh();
	
	// listen for addPoints events from the game.
	$(document).on("game.addPoints", this.addPoints.bind(this));
	$(document).on("game.setPoints", this.setPoints.bind(this));
};

Game.Widget.Scoreboard.prototype.addPoints = function (e, points) {
	if (typeof points === "number") {
		this.points += points;
		this.refresh();
	}
	return this.points;
};

Game.Widget.Scoreboard.prototype.subtractPoints = function (points) {
	this.points -= points;
	this.refresh();
	return this.points;
};

Game.Widget.Scoreboard.prototype.setPoints = function (e, points) {
	if (typeof points === "number") {
		this.points = points;
		this.refresh();
	}
	return this.points;
};

Game.Widget.Scoreboard.prototype.reset = function () {
	this.points = 0;
	this.refresh();
	return this.points;
};

Game.Widget.Scoreboard.prototype.refresh = function () {
	// fold in any special message, then display.
	var addPointsMessage = this.game.read("AddPoints") || ":points";
	addPointsMessage = addPointsMessage.insert_values(this.points);
	this.display.element.val(addPointsMessage);
};


/* 
 * Game.Widget.NullScoreboard
 * If you don't want a scoreboard, this will just fulfill the Scoreboard commands without doing anything.
 * We may also decide at some point that we want some of these functions to actually do something.
 */
Game.Widget.NullScoreboard = function () {};
Game.Widget.NullScoreboard.prototype.init = function (game) {};
Game.Widget.NullScoreboard.prototype.add = function (points) {};
Game.Widget.NullScoreboard.prototype.subtract = function (points) {};
Game.Widget.NullScoreboard.prototype.reset = function () {};
Game.Widget.NullScoreboard.prototype.refresh = function () {};