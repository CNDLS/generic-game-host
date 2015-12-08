/* PromptCards could eventually do cool things,
 * like introducing a NPC or opening up a new room,
 * but for the time being, we'll likely mostly use Simples and Modals.
 */

Game.PromptCard.Simple = Util.extendClass(Game.Card, function Game_PromptCard_Simple (args) {
	Game.Card.apply(this, args);
});


Game.PromptCard.Modal = Util.extendClass(Game.Card, function Game_PromptCard_Modal (args) {
	Game.Card.Modal.apply(this, args);
});
Game.PromptCard.Modal.prototype = new Game.Card.Modal(null); // Game_PromptCard_Modal's do not get a Continue btn w/o this!