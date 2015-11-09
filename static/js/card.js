/*
 * Interactions in the Game are governed by Cards and their managers: Prompt, Response, and Feedback objects.
 *
 */

/* FAILSAFE */
Game = Game || function () {};

/* 
 * Cards
 * Cards represent interactions with the player. They are represented by some DOM element(s).
 * The generic Card prototype specifies a generic 'deal' function, 
 * but that can be overridden by 'deal' function passed in a card spec.
 * Alternately, other Card prototypes can be defined on the Game object,
 * specifying animations, interactivity, even peer-to-peer communications through "cards."
 */
Game.Card = function(spec) {
	if (spec === null) {
		return; // this is when we are creating a Card to be a prototype for another type of object.
	} else if (spec instanceof String) {
		spec = spec.toString();
	} else if (spec instanceof Error) {
	  throw spec;
	}
	
	// some card-related constants.
	Game.Card.SEND_TO_BACK = -1;

  // save any custom style passed in.
  var css_class;
  if (spec.hasOwnProperty("css_class")) {
    css_class = spec.css_class;
    delete spec.css_class
  }
  
  // handle ref's to our media_url.
  spec = Util.replaceAll(spec, /MEDIA_URL\+/g, MEDIA_URL);
  
	// save the spec, in case we need to manipulate the card contents later on.
	this.spec = spec;
	
	// make space to save any dealer I'm associated with.
	this.dealer = {};
	
	// we want to always have a single HTML element to represent each Card.
	if ( ((spec instanceof HTMLElement) || (spec instanceof jQuery)) 
		&& ($(spec).attr("data-keep-in-dom") === "true")) {
		this.element = $(spec);
	} else if (spec["element"] instanceof jQuery) {
    this.element = spec.element;
    this.user_input_dfd = $.Deferred();
  } else {
		// remove 'type' from spec
		var card_type = spec.type || "";
		delete spec.type;
    
		in_production_try(this, function createCardElement () {
			var card_scaffold = $(document.createElement("div"));
            if (spec instanceof String) {
                spec = spec.toString()
            }
			var rendered_element = card_scaffold.render(spec.content || spec);
			this.load_promise = rendered_element.data().promise;
	
			// we want to always have a single HTML element to represent each Card.
			// so if the spec has generated siblings, we wrap them in a div.
			var nodes_in_card = card_scaffold.get(0).childNodes;
			switch (nodes_in_card.length) {
				case 0:
					console.log("Failed to create Card.", spec);
					break;
			
				case 1:
					// if it is a text node, use card_scaffold as the Card element.
					// otherwise, use the child node.
					var node = nodes_in_card[0];
					this.element = (node.nodeType == 3) ? card_scaffold : $(node);
					break;
			
				default:
					this.element = card_scaffold;
					break;
			}
		});
	}
	
	// add the generic card class.
	// keep track of this Card via the jQuery data for the element.
	// this will work, even if we use another jQuery selector to select this one element.
	this.element.addClass("card").data("card", this);
	if (card_type) {
		this.element.addClass(card_type);
	}
	
	// add any other saved css_classes.
	if (css_class || false) {
		this.element.addClass(css_class);
	}
	
	// respond to user and game actions and track what will get reported to the db.
	this.history = [];
	
	// will have to list out all types of Card events.
	var _this = this;
	this.element.on("Card.userInput", function (evt, data) {
		if (_this.element.is(this)) {
			var answer;
			try {
				data = data.answer;
			} catch (e) {
				data = JSON.stringify(data);
			}
			_this.history.push({ event: evt.namespace, data: data, timestamp: evt.timeStamp });
		}
	});
}

// default values for cards.
Game.Card.DEFAULTS = {
	timeout: null
};

Game.Card.prototype = $.extend(Game.Card.prototype, {
  
  style: function (css_classes) {
  	// remove card class and then add back those specified.
  	// this is done so we can keep cards out the 'clearCards' function.
  	// TODO: *** Look into a better way to do this. cards should remain '.card's ***
  	this.element.removeClass("card").addClass(css_classes);
  	return this; // for daisy-chaining.
  },

  find: function (selector) {
  	// just pass to element.
  	return this.element.find(selector);
  },

  // default way to activate/deactivate card is to set disabled attr on any input(s) and/or link(s) in the card.
  // we also set disabled on the card, in case it IS the interactive element, or if we want to do css on the card.
  setActive: function (flag) {
  	$(this.element).find("input, a").addBack().prop( "disabled", !flag );
  },

  dealTo: function (container) {
  	// find or create a place in the game in which to put the cards.
  	var container_spec = container || this.spec.container || this.dealer.container;
  	this.container = $(container_spec);
  	if (this.container.length == 0) {
  		this.container = $("#game");
  	}
  	$(this.container).append(this.element);
  },

  unbindEvents: function (in_event_names) {
  	// remove passed-in (or any) events bound to the card element, or any nested input or link elements.
  	var interactive_elements = this.element.find("input, a").addBack();
  	$(interactive_elements).each(function () {
  		var event_names = in_event_names || ( Object.keys($._data(this, "events") || {}).join(" ") );
  		$(this).off(event_names);
  	});
  },

  remove: function () {
  	this.unbindEvents();
  	this.element.remove();
  },

  // what I tell the Reporter about myself.
  getHistory: function () {
  	return this.history;
  },

  // return a descriptor string from the spec or create a jQuery descriptor for my element.
  getDescriptor: function () {
  	if (typeof this.spec === "string") { 
  		return this.spec;
  	} else {
  		return Util.createDescriptor(this.element.get(0));
  	}
  }
});


// a create method for basic Card types (as opposed to those controlled by Dealers).
Game.Card.create = function (spec) {
	var card_class = spec["type"] || "Card";
	var card;
	if (card_class === "Card"){
		card = new Game.Card(spec);
	} else {
		card = new Game.Card[card_class](spec);
	}
	return card;
}


/* 
 * Game.Card.Modal
 * Cards which 'stop the action' & require a user response.
 */
Game.Card.Modal = Util.extendClass(Game.Card, function (spec) {
  Game.Card.call(this, spec);
	// add the bit where we wait for the user.
	this.user_input_dfd = $.Deferred();
	this.user_input_promise = this.user_input_dfd.promise();
},
{
  dealTo: function (container) {
  	Game.Card.prototype.dealTo.call(this, container);
  	this.addOKButton();
  	return true;
  },
  
  addOKButton: function () {
  	// once the user clicks to continue, we can move onto the game.
  	// for now, we"re going to stick to the notion that all intros require a click to continue.
  	if (this.element.find("button.continue").length > 0) { 
  		return;
  	}
  	var _this = this;
  	var ok_button = $(document.createElement("button"))
  										.attr("href", "#")
  										.addClass("continue")
  										.html("Continue").click(function () {
  		_this.user_input_dfd.resolve();
  		_this.remove();
  	});
  	ok_button.appendTo(this.element);
  }
});


Game.Card.Action = Util.extendClass(Game.Card, function (spec) {
  spec.element = spec.element || $();
  Game.Card.call(this, spec);
  this.action = spec.action || $.noop;
}, {
  dealTo: function (container) {
    if (typeof this.action === "function") {
      this.action(this.dealer.round, this);
    } else if (typeof this.action['evaluate'] === "function") {
      var generated_action = this.action.evaluate(this.dealer.round);
      if (typeof generated_action === "function") {
        return generated_action(this.dealer.round, this);
      }
    }
  }
});