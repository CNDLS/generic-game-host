/* FAILSAFES */
Game = Game || function () {};
Game.Scene = Game.Scene || {};

Game.Scene.Lake = function (backdrop_spec, set_pieces_specs, game) {
	Util.extend_properties(this, new Game.Scene.Basic(backdrop_spec, set_pieces_specs, game));
};
Util.extend(Game.Scene.Lake, Game.Scene.Basic);

// leavenone
// enterGivePrompt
// leaveGivePrompt
// enterListenForPlayer
// leaveListenForPlayer
// enterEvaluateResponse
// leaveEvaluateResponse

Game.Scene.Lake.prototype.leavenone = function (evt, info) {
	
};

Game.Scene.Lake.prototype.enterGivePrompt = function (evt, info) {

};

Game.Scene.Lake.prototype.enterListenForPlayer = function (evt, info) {

};


Game.Scene.Lake.prototype.leaveListenForPlayer = function (evt, info) {
	var round = info.round;
	var responder = round.responder;
	var answer = info.args[0];
	var score = info.args[1];
	var _this = this;

	if (score === 1) {
		try {
			round.transition.cancel();
		} catch (e) {}
		info.continue = false;
		
		var replyToAnswer = $(".answers");
		replyToAnswer.html("");

		var boat = $(".boat");
		var boatContainer = $(".boat-container");
		var gas_gauge_needle = $(".gauge .needle");
		var gas_tank_icon = $(".gas_tank");
		var correctMove = (boatContainer.width() - boat.width()) / 20;
		var whereBoat = boat.position().left;
		boat.delay(900).animate({"left": whereBoat + correctMove}, 750);
		
		// show the gas increase * usage in the gas gauge.
		gas_gauge_needle.addClass("pulse");
		gas_tank_icon.show();
		setTimeout(function () {
			gas_tank_icon.hide();
			boat.addClass("fast");
		}, 900);
		setTimeout(function () {
			gas_gauge_needle.removeClass("pulse");
			boat.removeClass("fast");
			round.evaluate();
		}, 1500);
	}
	else {
		var replyToAnswer = $(".answers");
		if (info.args[0].content === "Por") {
			replyToAnswer.html(info.args[0].feedback);
			setTimeout(function () {
				replyToAnswer.hide();
			}, 1000);
		}
		else if (info.args[0].content === "Para") {
			replyToAnswer.html(info.args[0].feedback);
			setTimeout(function () {
				replyToAnswer.hide();
			}, 1000);
		}
	}
	
};

// Game.Scene.Lake.prototype.leaveEvaluateResponse = function (evt, info) {
// 	var score = info.round.responder.score;
// 	if (score == 0) {
// 		try {
// 			info.round.transition.cancel();
// 		} catch (e) {}
// 		info.continue = false;
// 	}
// 	var responder = info.round.responder;
// 	$(responder.cards[0].element).click(function (evt) {
// 		debugger;
// 	});
// };