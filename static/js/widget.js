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
      widget_type_name = Object.keys(widget_spec)[0];
      widget_spec = widget_spec[widget_type_name]; // pass whatever params to constructor.
      var widget_class = Game.Widget[widget_type_name];
      if (typeof widget_class !== "function") {
        throw new Error("There is no Widget defined with the name '" + widget_type_name + ".'")
      }
      return new widget_class(game,widget_spec);
    } else {
      console.log("Could not create widget from " + widget_spec);
    }
  } catch (e) {
    console.warn(e, widget_spec)
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
Game.Widget.CountdownClock.prototype = {
  
  start: function (evt, max_time) {
  	clearInterval(this.clock);
  	if (typeof max_time === "number") {
  		this.clock = setInterval(this.tick.bind(this), 1000);
  		this.clock_face.html(max_time);
      this.max_time = max_time;
  	}
  },

  tick: function () {
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
      // do nothing. it's just ornamentation.
    }
        
  	return current_time;
  },

  stop: function (evt) {
  	clearInterval(this.clock);
  },

  reset: function () {
  	this.stop();
  	this.clock_face.val(null);
  }
}




/* 
 * Game.Widget.Scoreboard
 * This is a default scoreboard -- it displays the current score in a field.
 * Custom scoreboards need to expose init(game), add(points), subtract(points), and a reset() functions.
 */
Game.Widget.Scoreboard = function (game, spec) {
  spec = spec || {};
  
  var content_spec;
  if (spec.hasOwnProperty("content")) {
    content_spec = spec.content;
    // remaining spec hash gets merged with this object.
    for (var m in spec) {
      this[m] = spec[m];
    }
  } else {
    content_spec = spec;
  }
  
  // set spec["div.scoreboard"] to be a textarea, plus whatever the passed-in spec describes.
  var card_spec = { "div.scoreboard": ["textarea[readonly=true]"] };

  var num_elements = Object.keys(spec).length;
  if (num_elements > 0) {
    if (content_spec.hasOwnProperty("0")) {
      for (var i=0; i<num_elements; i++) {
        card_spec["div.scoreboard"].push(content_spec[i]);
      }
    } else {
      card_spec["div.scoreboard"].push(content_spec);
    }
  }
  
  this.display = new Game.Card(card_spec);
  this.display.dealTo(spec.container || game.widgets_container);
	
	this.game = game;
	this.points = game.current_score;
	this.refresh();
	
	// listen for addPoints events from the game.
  if (!this.hasOwnProperty("detach")) {
  	$(document).on("game.addPoints", this.addPoints.bind(this));
  	$(document).on("game.setPoints", this.setPoints.bind(this));
  }
};

Game.Widget.Scoreboard.prototype = {
  addPoints: function (e, points) {
  	if (typeof points === "number") {
  		this.points += points;
  		this.refresh();
  	}
  	return this.points;
  },

  setPoints: function (e, points) {
  	if (typeof points === "number") {
  		this.points = points;
  		this.refresh();
  	}
  	return this.points;
  },

  refresh: function () {
  	// fold in any special message, then display.
    var addPointsMessage = this.game.read("AddPoints") || ":points";
  	addPointsMessage = addPointsMessage.insert_values(this.points);
  	this.display.find("textarea").val(addPointsMessage);
  }
}




/* 
 * Game.Widget.Table
 * Just a static HTML table, like a map key, available for reference by the user.
 * Later, a subclass may be interactive. Actually, this might make a good way to implement an Inventory area for found items.
 * NOTE: content for table headings and cells must be renderable by $.render().
 */
Game.Widget.Table = function (game, spec) {
  if (!spec.hasOwnProperty("headings")) {
    console.warn("You can't create a table without headings.", spec);
  }
  if (!spec.hasOwnProperty("rows")) {
    console.warn("You can't create a table without rows.", spec);
  }
  
  var table_spec = { table: {} };
  
  // headings.
  var headings = spec.headings;
  if (!(headings.hasOwnProperty("0"))) {
    headings = [headings];
  }
  
  table_spec.table["thead"] = { tr: [] };
  
  $.each(headings, function () {
    var heading = this;
    if (heading instanceof String) {
      heading = heading.toString();
    }
    table_spec.table.thead.tr.push({ th: heading.titleize() });
  });
    
  // rows.
  var rows = spec.rows;
  if (!(rows.hasOwnProperty("0"))) {
    rows = [rows];
  }
  
  table_spec.table["tbody"] = [];

  $.each(rows, function () {
    var row = this;
    var row_spec = { tr: [] };
    if (typeof row === "object") {
      $.each(headings, function () {
        var heading = this;
        var row_contents = row[heading];
        if (row_contents instanceof String) {
          row_contents = row_contents.toString();
        }
        row_spec.tr.push({ td: row_contents || "" });
      });
    } else {
      console.warn("Can't process table row.", this);
    }
    table_spec.table.tbody.push(row_spec);
  });

  // deal the table as a card.
  this.display = new Game.Card(table_spec);
  this.display.dealTo(spec.container || game.widgets_container);
}