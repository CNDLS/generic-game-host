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
	if (typeof spec === "string") {
		spec = { content: { "div": spec } };
	} else if (typeof spec === "number") {
		spec = { content: { "div": spec.toString() } };
	}
	this.spec = spec;
	
	Game.Card.DEFAULTS = {
		timeout: null,
		container: $("#cards")
	};
	
	// spec can contain template, klass, css_class, container, and deal <function>.
	// spec *must* contain content.
	// card_scaffold is a temporary structure. the card gets pulled out of it when 'dealt.'
	var card_scaffold = $(document.createElement("div"));
	this.element = $(document.createElement("div")).addClass("card");
	card_scaffold.append(this.element);
	// apply any general css_class in the spec to the first child of the card_holder.
	if (spec['css_class']) {
		this.element.addClass(spec.css_class);
	}
	this.card_front = $(document.createElement("div")).addClass("front");
	this.element.append(this.card_front);
	this.container = spec.container || Game.Card.DEFAULTS.container;
}

Game.Card.prototype.populate = function () {
	var spec = this.spec;
	// each card population is wrapped in a try.
	in_production_try(this,
		function () {
			if (typeof spec.content === "string" && spec.content.is_valid_html()) {
				this.card_front.append(spec.content);
			} else if (typeof spec.content === "object"){
				for (var key in spec.content) {
					var value = spec.content[key] || "";
					// 
					var key_spec = key.split(".");
					var tag_name = key_spec.shift(); // first item is tag name.
					var child_element;
					in_production_try(this,
						function () {
							child_element = $(document.createElement(tag_name));
						},
						function () {
							child_element = $(document.createElement("div"));
						}
					);
					this.card_front.append(child_element);
					if (key_spec.length) {
						child_element.addClass(key_spec.join(" "));
					}
					child_element.html(value);
				}
			}
		},
		function () {
			spec = { content: { "div":"card spec fail." } };
		}
	);
	
	// how to proceed from this card onward. Is it 'modal'? 
	if ((spec.okClick || false) && (typeof spec.okClick === "function")) {
		this.addOKButton(spec);
	} else if (spec.timeout || false) {
		// hold on the card for some predetermined time.
		if ((game.current_round.transition) && (typeof game.current_round.transition === "function")) {
			setTimeout(game.current_round.transition.bind(game), spec.timeout || Card.DEFAULTS.timeout);
		}
		// else, just leave the card up indefinitely.
	}
}

Game.Card.prototype.deal = function () {
	if (this.container === Game){
		this.container = window.game.container;
	}
	$(this.container).append(this.element);
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
	// put stuff on/into the card (some cards might not put anything into the DOM).
	card.populate();
	return card;
}


/* 
 * Game.Card.Modal
 * Cards which 'stop the action' & require a user response.
 */
Game.Card.Modal = function (spec) {
	// create a card in the normal way.
	Util.extend_properties(this, new Game.Card(spec));
	this.dfd = $.Deferred();
}
$.extend(Game.Card.Modal.prototype, Game.Card.prototype);

Game.Card.Modal.prototype.populate = function () {
	Game.Card.prototype.populate.apply(this);
	this.addOKButton();
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
	ok_button.appendTo(this.card_front);
};