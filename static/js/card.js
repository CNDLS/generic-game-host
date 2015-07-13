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
	}
	
	// default values for cards.
	Game.Card.DEFAULTS = {
		timeout: null
	};
	// some card-related constants.
	Game.Card.SEND_TO_BACK = -1;
	
	// save the spec, in case we need to manipulate the card contents later on.
	this.spec = spec;
	
	// make space to save any dealer I'm associated with.
	this.dealer = {};
	
	// we want to always have a single HTML element to represent each Card.
	if ( ((spec instanceof HTMLElement) || (spec instanceof jQuery)) 
		&& ($(spec).attr("data-keep-in-dom") === "true") ) {
		this.element = $(spec);
	} else {
		var card_scaffold = $(document.createElement("div"));
		var rendered_element = card_scaffold.render(spec.content || spec);
		this.load_promise = rendered_element.data().promise;
	
		// we want to always have a single HTML element to represent each Card.
		// so if the spec has generated siblings, we wrap them in a div.
		var nodes_in_card = card_scaffold.get(0).childNodes;
		switch (nodes_in_card.length) {
			case 0:
				throw new Error("Could not create Card.");
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
	}
	
	// add the generic card class.
	// keep track of this Card via the jQuery data for the element.
	// this will work, even if we use another jQuery selector to select this one element.
	this.element.addClass("card").data("card", this);
}

Game.Card.prototype.style = function (css_classes) {
	// remove card class and then add back those specified.
	this.element.removeClass("card").addClass(css_classes);
	return this; // for daisy-chaining.
}

Game.Card.prototype.find = function (selector) {
	// just pass to element.
	return this.element.find(selector);
}

// default way to activate/deactivate card is to set disabled attr on any input(s) and/or link(s) in the card.
// we also set disabled on the card, in case it IS the interactive element, or if we want to do css on the card.
Game.Card.prototype.setActive = function (flag) {
	$(this.element).find("input, a").addBack().prop( "disabled", !flag );
}

Game.Card.prototype.dealTo = function (container) {
	// find or create a place in the game in which to put the cards.
	var container_spec = container || this.spec.container || this.dealer.container;
	this.container = $(container_spec);
	if (this.container.length == 0) {
		this.container = $("#game");
	}
	$(this.container).append(this.element);
}

Game.Card.prototype.remove = function () {
	this.unbindEvents();
	this.element.remove();
}

Game.Card.prototype.unbindEvents = function (in_event_names) {
	// remove passed-in (or any) events bound to the card element, or any nested input or link elements.
	var interactive_elements = this.element.find("input, a").addBack();
	$(interactive_elements).each(function () {
		var event_names = in_event_names || ( Object.keys($._data(this, "events") || {}).join(" ") );
		$(this).off(event_names);
	});
}

// what I tell the Reporter about myself.
Game.Card.prototype.report = function () {
	return JSON.stringify(this.spec.content) || "undefined";
}

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
 * Game.Card.SequenceStep
 * Cards which are a part of a sequence of Cards.
 * When a Dealer encounters a SequenceStep Card, 
 * it halts dealing until the current list of promises is resolved,
 * then it deals cards again, until all are dealt 
 * or until the Dealer reaches another SequenceStep Card.
 */
Game.Card.SequenceStep = function (spec) {
	// create a card in the normal way.
	Util.extend_properties(this, new Game.Card(spec));
}
Util.extend(Game.Card.SequenceStep, Game.Card);
Game.Card.SequenceStep.prototype = new Game.Card(null); 


/* 
 * Game.Card.Modal
 * Cards which 'stop the action' & require a user response.
 */
Game.Card.Modal = function (spec) {
	// create a card in the normal way.
	Util.extend_properties(this, new Game.Card.SequenceStep(spec));
	// add the bit where we wait for the user.
	this.user_input_dfd = $.Deferred();
	this.user_input_promise = this.user_input_dfd.promise();
}
Util.extend(Game.Card.Modal, Game.Card.SequenceStep);
Game.Card.Modal.prototype = new Game.Card.SequenceStep(null); 

Game.Card.Modal.prototype.dealTo = function (container) {
	Game.Card.prototype.dealTo.call(this, container);
	this.addOKButton();
	return true;
}

Game.Card.Modal.prototype.addOKButton = function () {
	// once the user clicks to continue, we can move onto the game.
	// for now, we"re going to stick to the notion that all intros require a click to continue.
	var card = this;
	var onclick_handler = this.spec['okClick'] || $.noop;
	
	var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function () {
		card.user_input_dfd.resolve();
		card.remove();
		onclick_handler.call(card);
	});
	ok_button.appendTo(this.element);
};