/* 
 * Game.IntroDealer sets up the game & gives UI instructions.
 */
Game.IntroDealer = function (game, container) {
  Game.Dealer.call(this, game, container);
}
Util.extend(Game.IntroDealer, Game.Dealer);

Game.IntroDealer.DEFAULTS = {
	Type: "Modal", // a click-through Card.
	AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
}


Game.IntroDealer.prototype.introduce = function () {
	return this.waitForEachUserInput();
}