/* PromptCards could eventually do cool things,
 * like introducing a NPC or opening up a new room,
 * but for the time being, we'll likely mostly use Simples and Modals.
 */

Game.PromptCard.Simple = Util.extendClass(Game.Card, function (args) {
	var spec = args.shift();
	Game.Card.call(this, spec);
});


Game.PromptCard.Modal = Util.extendClass(Game.Card, function (args) {
	var spec = args.shift();
	Game.Card.Modal.call(this, spec);
});
Game.PromptCard.Modal.prototype = new Game.Card.Modal(null);