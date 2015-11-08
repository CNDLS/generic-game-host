/* Each ListenerCard will capture input form the user(s).
 * Upon receiving user input, the card resolves the Listener's Deferred,
 * passing one of the Answer objects created from the YAML spec for this Round.
 */


/* FreeResponseCard just creates a card with a text input field and doesn't care about the answer. */
Game.ListenerCard.FreeResponseCard = Util.extendClass(Game.Card, function (args) {
	var round = args.shift();
  Game.Card.call(this, { div:"input[type=text]" });
},
{
  dealTo: function (container) {
  	Game.Card.prototype.dealTo.call(this, container);
  	var _this = this;
  	this.element.find("input[type=text]").on("keypress", function (e) {
      if (e.keyCode === 13) {
  			var answer = new Game.Round.Answer(e.target.value, _this.dealer.round);
  			var score = 1; // any response is accepted.
  			$(_this.element).trigger("Card.userInput", { answer: answer, score: score });
  			e.target.blur();
  		}
  	});
  }
});



/* MultipleChoiceCard creates a card with a list of radio buttons, labelled with Answers from YAML. */
Game.ListenerCard.MultipleChoiceCard = Util.extendClass(Game.Card, function (args) {
	var round = args.shift();
	var spec = args.shift() || {};
	this.radio_btns = {};
	var group_name = spec.group_name || ("radio_group_" + round.nbr);
	var answers = spec.answers || round.answers;
	var prompt_html = "";
	if (spec.prompt || false) {
		prompt_html = "<li class='prompt'>" + spec.prompt + "</li>";
	}
	
	var _this = this;
	$.each(answers, function (i, answer_spec) {
		var answer = new Game.Round.Answer(answer_spec, round);
		var btn_id = "radio_btn_" + round.nbr + "_" + (i + 1) + "_" + S4(); // random 4-character code.
		_this.radio_btns[btn_id] =
			{ html: ("<li><input type=\"radio\" id=\"" + btn_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + btn_id + "\">" + answer.getContents() + "</label></input></li>"),
			  answer: answer,
			  btn_id: btn_id
			}
	});
	var radio_btn_html = $.map(this.radio_btns, function (btn, btn_id /* , ?? */) {
		return btn.html;
	}).join("\n");
	radio_btn_html = "<ul>" + prompt_html + radio_btn_html + "</ul>";
	Game.Card.call(this, radio_btn_html);
},
{
  dealTo: function (container) {
  	Game.Card.prototype.dealTo.call(this, container);
  	var respondToClick = this.respondToClick.bind(this);
  	this.element.find("input[type=radio]").on("click", respondToClick);
  },

  respondToClick: function (e) {
  	var clicked_radio_btn = this.radio_btns[e.target.id];
  	// add classes, so we can style if need be.
  	var correct = clicked_radio_btn.answer.get("correct", this.dealer.round) || false;
  	var value = clicked_radio_btn.answer.value || 1;
  	var neg_value = clicked_radio_btn.answer.negative_value || 0; // any penalty for answering incorrectly?
  	var answer = new Game.Round.Answer(clicked_radio_btn.answer, this.dealer.round);
  	var score = correct ? value : neg_value;
  	$(this.element).trigger("Card.userInput", { card: this, answer: answer, score: score});
  }
});




/* MultipleAnswerCard differs from MultipleChoiceCard, in that it is checkboxes
 * instead of radio buttons (ie; user can make multiple answers).
 * We will need a Submit buttion on the Card.
 * We should be able to create groupings. This could be used to populate
 * surveys as one round with multiple survey questions.
 */
Game.ListenerCard.MultipleAnswerCard = Util.extendClass(Game.Card, function (args) {
	var round = args.shift();
	var spec = args.shift() || {};
	var answers = spec.answers || round.answers;
	var prompt_html = "";
	if (spec.prompt || false) {
		prompt_html = "<li class='prompt'>" + spec.prompt + "</li>";
	}
	
	this.checkboxes = {};
	var group_name = "checkbox_group_" + round.nbr + S4();
	var _this = this;
	$.each(answers, function (i, answer_spec) {
		var answer = new Game.Round.Answer(answer_spec, _this.dealer.round);
		var checkbox_id = "checkbox_" + round.nbr + "_" + (i + 1) + "_" + S4(); // random 4-character code.
		_this.checkboxes[checkbox_id] =
			{ html: ("<li><input type=\"checkbox\" id=\"" + checkbox_id + "\" name=\"" + group_name + "\" value=\"\">"
						+ "<label for=\"" + checkbox_id + "\">" + answer.content + "</label></input></li>"),
			  answer: answer,
			  checkbox_id: checkbox_id
			}
	});
	var checkbox_html = $.map(this.checkboxes, function (checkbox, checkbox_id /* , ?? */) {
		return checkbox.html;
	}).join("\n");
	// wrap li's in a ul. add a submit button, to send state of checkboxes.
	var submit_btn_html = "<li><button type='submit' form='" + group_name + "_form' value='submit'>Submit</button></li>"
	checkbox_html = "<ul><form id='" + group_name + "_form'>" + prompt_html + checkbox_html + submit_btn_html + "</ul>";
  Game.Card.call(this, checkbox_html);
});



/* 
 * This card waits for a click on a link. 
 * args passed as an array.
 */
Game.ListenerCard.LinkCard = Util.extendClass(Game.Card, function (args) {
	this.round = args.shift();
	var elem = args.shift();
	$(elem).attr("data-keep-in-dom", true);
	Game.Card.call(this, elem);
},
{
  dealTo: function (container) {
  	var _this = this;
  	this.element.click(function (e) {
  		// disable the link after one click (maybe will want a double-click option at some point?)
  		$(this).prop('disabled', true);
  		// get answer & score, and pass them when resolving my promise (dfd).
  		var correct = _this.answer.get.bind(_this.dealer)("correct") || false;
  		var value = _this.answer.value || 1;
  		var neg_value = _this.answer.negative_value || 0; // any penalty for answering incorrectly?
  		var answer = new Game.Round.Answer(_this.answer, _this.dealer.round);
  		var score = correct ? value : neg_value;
  		_this.element.trigger("Card.userInput", {answer: answer, score: score});
  	});
  }
});



/* GroupedInputCard is just a holder for other cards. 
 * They all report together.
 */
Game.ListenerCard.GroupedInputCard = Util.extendClass(Game.Card, function (args) {
	Game.Card.call(this, "div");
});