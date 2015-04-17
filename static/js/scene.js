/*
 * Scenes are Dealers of Cards. Scenes must support a setStage() and a strikeStage() method,
 * when any Cards they contain get dealt and/or removed/replaced.
 * We make a distinction between Scene Cards and game Widgets, in that Scene Cards don't necessarily
 * persist through the whole Game and don't need to interact with the Game.
 * They're more decorative, but they can be functional wrt animations. 
 */


Game.Scene = {}
Game.SetPiece = {}


// a factory for creating Scenes (Dealers).
Game.SceneFactory = {
	create: function (scene_spec, game_or_round, events) {
		var scene_type_name = scene_spec.scene_type || "Basic";
		var backdrop_spec = scene_spec.backdrop || {};
		var set_piece_specs = scene_spec.set_pieces || [];
		var scene;
		in_production_try(this, function () {
			scene = new Game.Scene[scene_type_name](backdrop_spec, set_piece_specs, game_or_round);
			scene.init(events);
		});
		return scene;
	}
}

Game.Scene.Basic = function (backdrop_spec, set_piece_specs, game_or_round) {
	Util.extend_properties(this, new Game.Dealer(game_or_round));
	this.backdrop = new Game.Card(backdrop_spec);
	this.set_piece_specs = set_piece_specs;
	
	// keep references to game and round, if applicable.
	switch (true) {
		case (game_or_round instanceof Game):
			this.round = null;
			this.game = game_or_round;
			this.container = this.game.container;
			break;
			
		case (game_or_round instanceof Game.Round):
			this.round == game_or_round;
			this.game = game_or_round.game;
			this.container = this.round.container;
			break;
	}
	this.onstage = false; // we should be able to switch out scenes while saving their state.
}
$.extend(Game.Scene.Basic.prototype, Game.Dealer.prototype);


Game.Scene.Basic.prototype.init = function (events) {
	// track Game.newRound events
	$(document).on("Game.newRound", this.setup.bind(this));
	
	// track all of the state transitions that happen in Rounds.
	// *** insure that only one listener gets created for each enter and leave event.
	var round_events = $.collect(events, function () {
		return "Round.leave" + this.from + " Round.enter" + this.to;
	}).getUnique().join(" ");
	$(document).on(round_events, this.trackRound.bind(this));
}


// I respond to Round setup events by loading my background and dealing my cards.
Game.Scene.Basic.prototype.setup = function (evt, obj) {
	if (!this.onstage) {
		// all scene types get defined on Game.Scene, so we can loop 
		// through them to discover our class.
		var scene_type_names = Object.keys(Game.Scene);
		var _this = this;
		var scene_class = $.any(scene_type_names, function () {
			if (Game.Scene[this] === _this.constructor) {
				return this.underscore();
			}
		}) || "";
		
		var backdrop_classes = "backdrop " + scene_class;
		this.backdrop.style(backdrop_classes);
		this.backdrop.dealTo(this.container, null, Game.Card.SEND_TO_BACK);
		// create the set pieces and place (deal) them.
		var _this = this;
		this.set_pieces = $.each(this.set_piece_specs, function (i, card_spec) {
			var set_piece = _this.addCard(Game.SetPieceFactory.create(card_spec));
			set_piece.style("set_piece").dealTo(_this.backdrop.element);
		});
		this.onstage = true;
	}
}


Game.Scene.Basic.prototype.trackRound = function (evt, state_info) {
	console.log("tracking", evt.namespace, state_info);
}



/*
 * SetPieces are the Cards held by a Scene.
 */


// a factory for creating SetPieces (Cards).
Game.SetPieceFactory = {
	create: function (set_piece_spec) {
		var set_piece_type_name = set_piece_spec["set_piece_type"] || "Basic";
		return in_production_try(this, function () {
			return new Game.SetPiece[set_piece_type_name](set_piece_spec);
		});
	}
}

Game.SetPiece.Basic = function (card_spec) {
	Util.extend_properties(this, new Game.Card(card_spec));
}
$.extend(Game.SetPiece.Basic.prototype, Game.Card.prototype);
Game.SetPiece.Basic.prototype = new Game.Card(null); 