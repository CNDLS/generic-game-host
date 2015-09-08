/*
 * Scenes are Dealers of Cards. Scenes must support a setStage() and a strikeStage() method,
 * when any Cards they contain get dealt and/or removed/replaced.
 * We make a distinction between Scene Cards and game Widgets, in that Scene Cards don't necessarily
 * persist through the whole Game and don't need to interact with the Game.
 * They're more decorative, but they can be functional wrt animations. 
 */


Game.Scene = {}
Game.Scene.new = Game.new.bind(Game.Scene);
Game.SetPiece = {}


// a factory for creating Scenes (Dealers).
Game.SceneFactory = {
	create: function (game, scene_spec, events) {
		var scene_type_name = scene_spec.scene_type || "Basic";
		var backdrop_spec = scene_spec.backdrop || "div";
		var set_piece_specs = scene_spec.set_pieces || [];
		
		var scene_type, scene;
		in_production_try(this, function () {
			if (Game.Scene.hasOwnProperty(scene_type_name)) {
				scene_type = Game.Scene[scene_type_name];
			} else {
				scene_type = Game.Scene.Basic;
			}
			scene = new scene_type(scene_type_name, backdrop_spec, set_piece_specs, game);

      if (events === "mock") { return scene; }
      
			scene.init(events);

			// associate scene w the rounds it is used in.
			scene.rounds = scene_spec.rounds || [];
			// pull rounds spec from scene YAML.
			if ((typeof scene.rounds === "object") && (scene.rounds[0])) {
				scene.rounds = scene.rounds[0];
			} 
			if (scene.rounds instanceof Array) {
				// do nothing. that's what we want.
			} else if (!isNaN(Math.round(scene.rounds))) {
				// if it is a number, put that in (make sure it is an integer).
				scene.rounds = [Math.round(scene.rounds)];
			} else if (typeof scene.rounds === "string") {
				if (scene.rounds === "all") {
					// make an array of all rounds.
					scene.rounds = $(game.rounds).collect(function (i) { return i + 1; });
				} else {
					// match to a regex that will pull all numbers & indicate 'runs'.
					// assemble an array.
					scene.rounds = Util.numberArrayFromTokenList(scene.rounds);
				}
				
			} else {
				console.warn("Can't assign scene to rounds", scene, scene.rounds);
				scene.rounds = [];
			}
		});

		return scene;
	}
}

Game.Scene.Basic = function (scene_type_name, backdrop_spec, set_piece_specs, game) {
	Util.extend_properties(this, new Game.Dealer(game));
	this.scene_type_name = scene_type_name;
	this.backdrop = new Game.Card(backdrop_spec);
	this.set_piece_specs = set_piece_specs;
	this.onstage = false; // we should be able to switch out scenes while saving their state.
}
Util.extend(Game.Scene.Basic, Game.Dealer);


Game.Scene.Basic.prototype.init = function (events) {
	// track all of the state transitions that happen in Rounds.
	// *** insure that only one listener gets created for each enter and leave event.
	var round_events = $.collect(events, function () {
		return "Round.leave" + this.from + " Round.enter" + this.to;
	});
	// strip out duplicates and put into a space-delimited string.
	round_events = Array.getUnique(round_events).join(" ");
	
	var _this = this;
	$(document).on(round_events, function (evt, state_info) {
		return _this.trackRound(evt, state_info)
	});
}


// I respond to Round setup events by loading my background and dealing my cards.
Game.Scene.Basic.prototype.setup = function (round) {
	var dfd = $.Deferred();
	if (!this.onstage) {
		var backdrop_classes = "backdrop " + this.scene_type_name.underscore();
		this.backdrop.style(backdrop_classes);
		
		// put down the backdrop, then create and add the set pieces.
		var _this = this;
		this.deal(this.backdrop).then(function () {
			_this.set_pieces = $.collect(_this.set_piece_specs, function (i) {
				var card_spec = this;
				var set_piece = _this.addCard(Game.SetPieceFactory.create(card_spec));
				set_piece.style("set_piece");
				return set_piece;
			});
			// deal the set pieces into the backdrop.
			_this.deal(_this.set_pieces, _this.backdrop.element).then(function() {
				// once all the Cards are dealt, call finalize(), 
				// so custom scripts will have access to them all.
				_this.finalize(round);
				_this.onstage = true;
				// all round to move on.
				dfd.resolve();
			});
		});
	} else {
		dfd.resolve();
	}
	
	return dfd.promise();
}


Game.Scene.Basic.prototype.tearDown = function () {
	$(this.cards).each(function () {
		this.remove();
	});
	this.backdrop.remove();
}

Game.Scene.Basic.prototype.finalize = function () {
	// kept for custom code.
}

Game.Scene.Basic.prototype.trackRound = function (evt, state_info) {
	// game scenes can have a handler function named for entering or leaving any Round state,
	// which will get executed at that point.
	// if an appropriate handler is defined on the scene,
	// call it, passing the event and the info object.
	// don't interrupt the game if there are any problems, as
	// this is all for decoration.
	try {
		if (typeof this[evt.namespace] === "function") {
			return (this[evt.namespace]).bind(this)(evt, state_info);
		}
	} catch (e) {
		console.error("Scene error in responding to Round state transition.", evt, e, e.stack);
	}
}

/*
 * SetPieces are the Cards held by a Scene.
 */


// a factory for creating SetPieces (Cards).
Game.SetPieceFactory = {
	create: function (set_piece_spec) {
		var set_piece_type_name = set_piece_spec["set_piece_type"] || "Basic";
		var set_piece_spec = Util.replaceAll(set_piece_spec, /MEDIA_URL\+/g, MEDIA_URL);
		return in_production_try(this, function () {
			return new Game.SetPiece[set_piece_type_name](set_piece_spec);
		});
	}
}

Game.SetPiece.Basic = function (card_spec) {
	Util.extend_properties(this, new Game.Card(card_spec));
}
Util.extend(Game.SetPiece.Basic, Game.Card);
Game.SetPiece.Basic.prototype = new Game.Card(null); 