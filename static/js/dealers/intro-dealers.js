/* 
 * Game.IntroDealer sets up the game & gives UI instructions.
 */
Game.IntroDealer = Util.extendClass(Game.Dealer, function (game, container) {
  Game.Dealer.call(this, game, container);
},
{
  introduce: function () {
  	return this.waitForEachUserInput();
  }
});

Game.IntroDealer.DEFAULTS = {
	Type: "Modal", // a click-through Card.
	AcceptUserInput: "each" // deliver Modal Cards one at-a-time.
}