/* PromptCards could eventually do cool things,
 * like introducing a NPC or opening up a new room,
 * but for the time being, we'll likely mostly use Simples and Modals.
 */

Game.PromptCard.Simple = function (args) {
	var spec = args.shift();
	Game.Card.call(this, spec);
}
Util.extend(Game.PromptCard.Simple, Game.Card);


Game.PromptCard.Modal = function (args) {
	var spec = args.shift();
	Game.Card.Modal.call(this, spec);
}
Util.extend(Game.PromptCard.Modal, Game.Card.Modal);
Game.PromptCard.Modal.prototype = new Game.Card.Modal(null);