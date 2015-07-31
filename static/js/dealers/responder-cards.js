/* ResponderCards could have an NPC speak, etc,
 * but for the time being, we'll likely mostly use Simples.
 */
Game.ResponderCard.Simple = function (args) {
	var round = args.shift();
	var answer = args.shift();
	var score = args.shift();
	if (answer.feedback) {
		Util.extend_properties(this, new Game.Card.Modal(answer.feedback));
	}
}
Util.extend(Game.ResponderCard.Simple, Game.Card.Modal);