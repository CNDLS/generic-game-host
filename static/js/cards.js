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
Game.Card = function(spec, container) {
	if (spec === null) {
		return; // this is when we are creating a Card to be a prototype for another type of object.
	}
	
	// default values for cards.
	Game.Card.DEFAULTS = {
		timeout: null,
		container: $("#cards")
	};
	// some card-related constants.
	Game.Card.SEND_TO_BACK = -1;
	
	this.spec = spec;
	this.container = container || Game.Card.DEFAULTS.container;
	
	// we want to always have a single HTML element to represent each Card.
	var card_scaffold = $(document.createElement("div"));
	card_scaffold.render(spec.content || spec);
	
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
	
	this.element.addClass("card");
}

Game.Card.prototype.style = function (css_classes) {
	this.element.addClass(css_classes);
	return this; // for daisy-chaining.
}


Game.Card.prototype.deal = function (dfd, position) {
	this.dfd = dfd || $.Deferred();
	if (this.container === Game){
		this.container = window.game.container;
	}
	if (position === Game.Card.SEND_TO_BACK) {
		$(this.container).prepend(this.element);
	} else {
		$(this.container).append(this.element);
	}
}

// what I tell the Reporter about myself.
Game.Card.prototype.report = function () {
	return JSON.stringify(this.spec.content) || "undefined";
}

Game.Card.create = function (spec) {
	var card_class = spec["klass"] || "Card";
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
Game.Card.Modal = function (spec) {
	// create a card in the normal way.
	Util.extend_properties(this, new Game.Card(spec));
}
$.extend(Game.Card.Modal.prototype, Game.Card.prototype);
Game.Card.Modal.prototype = new Game.Card(null); 

Game.Card.Modal.prototype.deal = function (dfd) {
	Game.Card.prototype.deal.call(this, dfd);
	this.addOKButton();
	return true;
}

Game.Card.Modal.prototype.addOKButton = function () {
	// once the user clicks to continue, we can move onto the game.
	// for now, we"re going to stick to the notion that all intros require a click to continue.
	var card = this;
	var onclick_handler = this.spec['okClick'] || $.noop;
	var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function () {
		card.element.remove();
		card.dfd.resolve();
	});
	ok_button.appendTo(this.element);
};