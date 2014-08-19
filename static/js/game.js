/******************************************************************************
 * Generic Game Engine
 * Copyright (c) 2014 Bill Garr and CNDLS, Georgetown University -- https://github.com/CNDLS/generic-game-host
 * Released under Creative Commons license -- http://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * VERSION 0.1.0
 * (release notes to go here).
 ******************************************************************************/

/* 
 * Game
 */
function Game(game_spec){
	this.DEFAULTS = {
		Title: "Generic Game",
		Rounds: [],
		Utilities: {},
		Intro: "Welcome to the game!",
		Resources: {},
		WonGameFeedback: "<h3>Hey, you won!</h3>",
		LostGameFeedback: "<h3>That didn't work out so well; you lost. Better luck next time!</h3>"
	}
	
	this.spec = game_spec;
	this.spec.setDefaultContext(this);
	
  this.current_round;
  this.round_nbr = 0;
	
	this.rounds = this.spec.get("Rounds") || this.DEFAULTS.Rounds; // the rounds of the game.
	this.utils = this.spec.get("Utilities") || this.DEFAULTS.Utiilities; // reusable functions.
	this.title = $("#title").html(this.spec.get("Title") || this.DEFAULTS.Title);
  
	// execute any customization, defined in play.html template.
	if (typeof (window.customize || null) == "function"){ customize(this); }

	// record the time the game was started.
  window.reporter.addData({ event: "start of game" });
	
	// start the game.
  this.setup();
}

Game.prototype.setup = function(){
  // introduce any explanatory note. place them on onscreen 'cards,' styled for each game.
	var intro_prompt = this.spec.get("Intro") || this.DEFAULTS.Intro;
	// attach spec for an intro card to the game, so we can optionally edit it in a setup_function.
	this.intro_card = {
											title: "Introduction", 
											content: intro_prompt, 
											class: "intro", 
											container: "#cards"
										}
	
	// collect any global_resources that may become available to the user throughout the game.
	// attach global_resources to the game, so we can optionally edit them in a setup_function.
  this.global_resources = this.spec.get("Resources") || this.DEFAULTS.Resources;

	// just calling get() on a YAML fragment will execute a function if that is what is returned,
	// so this has the effect of doing any custom setup that is refered to in the this.spec.
	this.spec.get("SetUpGame");
	
	// deliver the intro card. we will require a click-through on this card.
	var intro_card = new Card(this.intro_card);
	intro_card.addOKButton(this.newRound.bind(this));
}

Game.prototype.tick = function(){
  if (!!this.current_round && this.current_round.is("WaitForPlayer")){
    var current_time = this.clock_face.val() - 1;
    this.clock_face.val(current_time);
    if (current_time == 0){
      this.current_round.timeout();
    }
  }
}

Game.prototype.startClock = function(max_time){
  clearInterval(this.clock);
  this.clock = setInterval(this.tick.bind(this), 1000);
  this.clock_face.val(max_time);
}

Game.prototype.stopClock = function(){
  clearInterval(this.clock);
}

Game.prototype.addPoints = function(points){
  this.cumulative_score += points;
  this.points_display.val(this.cumulative_score);
	var addPointsMessage = this.spec.get("AddPoints") || ":points".insert_values(points);
	addPointsMessage = addPointsMessage.insert_values(points);
  this.sendMessage(addPointsMessage);
}

Game.prototype.gameFeedback = function(){
  if (this.cumulative_score >= this.spec.get("winning_score")){
		var gameFeedbackMessage = this.spec.get("WonGameFeedback") || ":points";
  } else {
		var gameFeedbackMessage = this.spec.get("LostGameFeedback") || ":points";
  }
	gameFeedbackMessage = gameFeedbackMessage.insert_values(this.cumulative_score);
	var feedback_card = $(createCard(gameFeedbackMessage, "", "ruling", "#prompts"));
  this.sendMessage(gameFeedbackMessage);
}

Game.prototype.sendMessage = function(msgText){
  console.log(" - " + msgText);
}

Game.prototype.allowReplay = function(){
  $("#top .replay").show();
}

Game.prototype.newRound = function(){
  // do reporting here.
  // only advance upon successfully reporting progress.
  // if there's a communications failure, we'll at least know when it happened.
  var game = this;
	window.reporter.sendReport(function(){
	  if (game.rounds.length){
      delete game.current_round;
      game.current_round = new Round(game.rounds.shift(), game);
      ++game.round_nbr;
      game.current_round.start();
    } else {
      game.gameFeedback();
			game.allowReplay();
    }
	});
}


/* 
 * Rounds of the Game.
 */
function Round(round_spec, game) {
	if (round_spec == undefined){
		console.log("no round_spec provided");
		return;
	}
	
  this.game = game;
	this.nbr = this.game.round_nbr;
	this.spec = round_spec;
	this.spec.setDefaultContext(game);

	this.DEFAULTS = {
		Points: 1,
		Resources: {},
		MaxTime: 3000,
		Prompt: "Round :nbr",
		WonRoundFeedback: "<h3>Good Round!</h3>",
		LostRoundFeedback: "<h3>Sorry, you lost that round.</h3>"
	}	
	
  this.resources = this.spec.get("Resources") || this.DEFAULTS.Resources;
  this.pointValue = this.spec.get("Value") || this.DEFAULTS.Points;
  this.max_time = this.spec.get("MaxTime") || this.DEFAULTS.MaxTime;
	this.played_round = {}; // to store data of what happened in the round.

  // event names start with lower case. 
  // state names start with upper case, so their callback names will be camel-case (eg; onPlayEvidenceCard)
	this.events = [
        { name: 'start',        from: 'none',                                    to: 'PresentRound' },
        { name: 'prompt',     	from: 'PresentRound',                            to: 'GivePrompt' },
        { name: 'wait',         from: 'GivePrompt',	      				               to: 'WaitForPlayer' },
        { name: 'respond',      from: 'WaitForPlayer',                           to: 'UserResponds' },
        { name: 'pass',		      from: 'WaitForPlayer',                           to: 'UserPasses' },
        { name: 'evaluate',     from: 'UserResponds',                            to: 'EvaluateResponse' },
        { name: 'correct',      from: 'EvaluateResponse',                        to: 'CorrectResponse' },
        { name: 'incorrect',    from: 'EvaluateResponse',                        to: 'IncorrectResponse' },
        { name: 'timeout',      from: 'WaitForPlayer',                           to: 'IncorrectResponse' },
        { name: 'advance',      from: ['CorrectResponse','IncorrectResponse'],   to: 'end' }
     ];
		 
	// debugging.
	this.onchangestate = function(){
		console.log(arguments);
	};
	
	// INTIALIZING THE ROUND.
	this.spec.get("SetUp");

  // create a StateMachine to track what user can do in various situations.
  $.extend(this, StateMachine.create({ events: this.events }));
}

Round.prototype.onstart = function(eventname, from, to){
  this.game.sendMessage("Starting Round " + this.nbr);
	var round = this;
	// record the start time of the round.
	window.reporter.addData({ round_nbr: this.nbr, event: "start of round" });
	this.prompt();
}

Round.prototype.onPresentRound = function(){
	// do any presentation that sets up the round for the player(s).
	var presentation = this.spec.get("Present");
	return presentation ? StateMachine.ASYNC : false;
}

Round.prototype.onGivePrompt = function(){
  var prompt = this.spec.get("Prompt") || this.DEFAULTS.Prompt;
	var prompt_card = {
											title: "Round :nbr".insert_values(this.nbr), 
											content: prompt, 
											class: "round_prompt", 
											container: "#cards"
										}
	// deliver the prompt card. we will require a click-through on this card.
	prompt_card = new Card(prompt_card);
	prompt_card.addOKButton(this.wait.bind(this));
}

Round.prototype.onWaitForPlayer = function(){
  this.game.startClock(this.max_time);
}

// doing a little more cleanup now, before we issue the ruling.
Round.prototype.onbeforeevaluate = function(){
  this.game.stopClock();
}

//  user 'passes' on their turn.
Round.prototype.onbeforepass = function(){	
  this.game.stopClock();
}

Round.prototype.onEvaluateResponse = function(){
	// s/b custom. find user response and compare to some stored values.
	// this is a stub, to be replaced by a round_initer function in the YAML game spec. 
	var correct = true;
	if (correct) {
		this.correct();
	} else {
		this.incorrect();
	}
}

Round.prototype.onleaveEvaluateResponse = function(eventname, from, to){
  this.ruling_card = $(createCard(eventname.capitalize().past_tense() + ".", "", "ruling", "#questions"));
	// no animation. just hold on the ruling long enough for the user to read it.
	setTimeout(this.transition.bind(this), 2000);
  
	return StateMachine.ASYNC;
}

Round.prototype.onCorrectResponse = function(){
  this.advance();
}

Round.prototype.onIncorrectResponse = function(){
  this.game.sendMessage(arguments[0].toString());
  this.advance(); 
}

Round.prototype.onbeforetimeout = function(){
  this.game.sendMessage("ran out of time.");
  this.game.stopClock();
}

Round.prototype.onbeforeadvance = function(){
	try{
		// write out the user data.
		window.reporter.addData(this.played_round)
		
	} catch(e){ console.log(e) }
}

Round.prototype.onend = function(){
  defer(this.game.newRound, this.game);
}


/* 
 * Cards
 * Use a template in the html page to generate 'cards,' any (potentially animated) messages to the player.
 */
function Card(spec){
	// spec can contain template, title, content, class, container.
	// spec *must* contain at least content and container.
  var card_holder = $(document.createElement('div'));
  card_holder.html(spec.card_template || Card.default_template);
  var card_front = card_holder.find(".front") || card_holder;
  if (spec.title || false) card_front.find("h2").html(spec.title);
  if (spec.class || false) card_holder.find("div.card").addClass(spec.class);
	this.elem = card_holder.children().first();
	if (spec.content && (spec.content != "")){
	  card_front.append(spec.content);
	}
  $(spec.container).append(this.elem);
}

Card.default_template = $("#card_template").html();

Card.prototype.addOKButton = function(onclick_handler){
	// once the user clicks to continue, we can move onto the game.
	// for now, we're going to stick to the notion that all intros require a click to continue.
	var card = this;
  var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function(){
		card.elem.remove();
		setTimeout(function(){ onclick_handler.call(); delete card; }, 500); // pause before triggering animations?
  });
	ok_button.appendTo(this.elem)
}


// This is what gets it all started. It gets called once we've retrieved & parsed a valid game YAML file.
function BuildGame(parsed_game_data){
	try {
		new Game(parsed_game_data);
	 } catch (err){
		alert("Warning: cannot build game. " + err);
		var obj = {};
		Error.captureStackTrace(err);
		console.log(obj.stack);
	}
}