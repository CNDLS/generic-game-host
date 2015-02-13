/* 
 * Each state in a Game Round is governed by a Dealer.
 * The managers are: Prompter, Listener, and Responder.
 * Each operates by creating Cards, dealing them, and 
 * co-ordinating between them to decide when to move on to the next state.
 * start() instantiates a Prompter,
 * wait() instantiates a Listener,
 * evaluate() instantiates a Responder.
 * Dealer created earlier persist throughout the Round.
 * They all borrow functionality from the Dealer prototype.
 */

Game.Dealer = function (context) {
	this.context = context; // game or round.
	var _this = this;
	this.cards = [];
}
// default action for dealing cards is just to put them onscreen,
// and then resolve the promise right away.
Game.Dealer.prototype.dealCards = function (successFn) {
	var deal_promises = $(this.cards).collect(function() {
		var dfd = $.Deferred();
		// deal the card, passing the deferred object,
		// which it can take the responsibility for and then must
		// dfd.resolve() once the card is dealt.
		// if it takes on that responsibility, card.deal() returns true.
		// REMEMBER, at this point, the Card is just saying whether or not it has been dealt;
		// Cards that wait for user input once they've been dealt should do so via a different dfd.
		( this.deal(dfd) ) ? $.noop() : dfd.resolve();
		return dfd.promise();
	});
	// weird construction lets us put our array of promises into params of $.when().
	$.when.apply($, deal_promises).then(successFn || $.noop);
}
Game.Dealer.prototype.addCard = function (card_or_spec) {
	var card = card_or_spec;
	if (typeof card_or_spec !== "function"){
		card = Game.Card.create(card_or_spec);
	}
	this.cards.push(card);
	return card;
}
// deal one specified card, regardless of what else might be in the Dealer's 'deck'.
Game.Dealer.prototype.dealOneCard = function (card_or_spec, successFn) {
	var sv_cards = this.cards;
	this.cards = [];
	var card = this.addCard(card_or_spec);
	this.dealCards(successFn);
	this.cards = sv_cards;
	return card; // card contains the promise of being dealt.
}
// forget all my cards.
Game.Dealer.prototype.discardAll = function () {
	this.cards = [];
	// anything to do with any pending dfd's?
}


/* 
 * Prompter handles setting up a Round.
 * It provides whatever information a Player needs to play the round.
 */
Game.Prompter = function (round) {
	$.extend(this, new Game.Dealer(round));
	
	// deliver the prompt card(s) from the current Round spec.
	var prompts = this.round.read("Prompt");
	if (prompts.constructor !== Array){ prompts = [prompts]; }
	var _this = this;
	$.each(prompts, function (i, prompt) {
		_this.addCard(prompt);
	});
}
$.extend(Game.Prompter.prototype, Game.Dealer);