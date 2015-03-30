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
	create: function (scene_spec, game) {
		var scene_type_name = scene_spec["scene_type"] || "Basic";
		var set_pieces = scene_spec["set_pieces"] || [];
		var scene;
		in_production_try(this, function () {
			scene = new Game.Scene[scene_type_name](set_pieces, game);
		});
		return scene;
	}
}

Game.Scene.Basic = function (scene_card_specs, game) {
	Util.extend_properties(this, new Game.Dealer(game));
	var _this = this;
	this.set_pieces = $.each(scene_card_specs, function (i, card_spec) {
		_this.addCard(new Game.SetPieceFactory.create(card_spec, _this));
	});
}
$.extend(Game.Scene.Basic.prototype, Game.Dealer.prototype);



/*
 * SetPieces are the Cards held by a Scene.
 */


// a factory for creating SetPieces (Cards).
Game.SetPieceFactory = {
	create: function (set_piece_spec, scene) {
		var set_piece_type_name = set_piece_spec["set_piece_type"] || "Basic";
		in_production_try(this, function () {
			return new Game.SetPiece[set_piece_type_name](set_piece_spec, scene);
		});
	}
}

Game.SetPiece.Basic = function (card_spec, scene) {
	Util.extend_properties(this, new Game.Card(card_spec, scene));
}
$.extend(Game.SetPiece.Basic.prototype, Game.Card.prototype);