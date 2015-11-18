/* 
 * ResponderCards could have an NPC speak, etc,
 * but for the time being, we'll likely mostly use Simples.
 */
Game.ResponderCard.Simple = Util.extendClass(Game.Card.Modal, function Game_ResponderCard_Simple (args) {
	var round = args.shift();
	var feedback = args.shift();
	var answer = args.shift();
	var score = args.shift();
	if (feedback) {
		Game.Card.Modal.call(this, feedback);
	}
});

/* 
 * ResponderActionCards are ActionCards, they stand in the place of actions.
 * Their dealTo() functions are hijacked to enact their action.
 */
Game.ResponderCard.Action = Util.extendClass(Game.Card.Action, function Game_ResponderCard_Action (args) {
	var round = args.shift();
	var feedback = args.shift();
	var answer = args.shift();
	var score = args.shift();

  Game.Card.Action.call(this, { action: feedback.action });
});