/******************************************************************************
 * Generic Game Engine
 * VERSION 0.1.0
 * (copyright info to go here).
 * (release notes to go here).
 ******************************************************************************/

function Game(game_spec){
	var game = window.Game = this;
	
  this.current_round;
  this.round_nbr = 0;
	
	this.rounds = game_spec.get("Rounds", game) || []; // the rounds of the game.
	this.utils = game_spec.get("Utilities", game) || {}; // reusable functions.
	this.title = $("#title").html(game_spec.get("title", game) || "Generic Game");

  this.setup = function(){
    // introduce any explanatory note. place them on onscreen 'cards,' styled for each game.
		var intro_prompt = game_spec.get("Intro", game) || "Welcome to the game!";
		// attach spec for an intro card to the game, so we can optionally edit it in a setup_function.
		game.intro_card = {
												title: "Introduction", 
												content: intro_prompt, 
												type: "intro", 
												container: "#cards"
											}
		
		// collect any global_resources that may become available to the user throughout the game.
		// attach global_resources to the game, so we can optionally edit them in a setup_function.
    game.global_resources = game_spec.get("Resources", game) || {};

		// just calling get() on a YAML fragment will execute a function if that is what is returned,
		// so this has the effect of doing any custom setup that is refered to in the game_spec.
		var setup_function = game_spec.get("SetUpGame", game);
		
		// deliver the intro card.
		var intro_card = $(createCard(game.intro_card));
		
		// once the user clicks to continue, we can move onto the game.
		// for now, we're going to stick to the notion that all intros require a click to continue.
    var ok_button = $(document.createElement("button")).attr("href", "#").html("Continue").click(function(){
      $(this).remove();
			intro_card.remove();
       
       // once the animations etc. are done, start the first round.
       setTimeout(function(){ game.newRound(); }, 500);
    });
		ok_button.appendTo(intro_card);
	}

  this.tick = function(){
    if (!!this.current_round && this.current_round.is("WaitForPlayer")){
      var current_time = this.clock_face.val() - 1;
      this.clock_face.val(current_time);
      if (current_time == 0){
        this.current_round.timeout();
      }
    }
  }
  
  this.startClock = function(max_time){
    clearInterval(this.clock);
    this.clock = setInterval(this.tick.bind(this), 1000);
    this.clock_face.val(max_time);
  }
  
  this.stopClock = function(){
    clearInterval(this.clock);
  }
  
  this.addPoints = function(points){
    this.cumulative_score += points;
    this.points_display.val(this.cumulative_score);
		var addPointsMessage = game_spec.get("AddPoints") || ":points";
		addPointsMessage = addPointsMessage.insert_values(points);
    this.sendMessage(addPointsMessage);
  }
  
  this.gameFeedback = function(){
    if (this.cumulative_score >= game_spec.get("winning_score")){
			var gameFeedbackMessage = game_spec.get("WonGameFeedback") || ":points";
    } else {
			var gameFeedbackMessage = game_spec.get("LostGameFeedback") || ":points";
    }
		gameFeedbackMessage = gameFeedbackMessage.insert_values(this.cumulative_score);
		var feedback_card = $(createCard(gameFeedbackMessage, "", "ruling", "#prompts"));
    this.sendMessage(gameFeedbackMessage);
  }
  
  this.sendMessage = function(msgText){
    console.log(" - "+msgText);
  }

  this.newRound = function(){
    // do reporting here.
    // only advance upon successfully reporting progress.
    // if there's a communications failure, we'll at least know when it happened.
    var game = this;
		window.reporter.sendReport(function(){
			console.log(game.rounds)
		  if (game.rounds.length){
        delete game.current_round;
        game.current_round = new Round(game.rounds.shift(), game);
        ++game.round_nbr;
        game.current_round.start();
      } else {
        game.gameFeedback();
        $("#top .replay").show();
      }
		});
  }
  
  window.reporter.addData({ event: "start of game" })
  this.setup();
}



function Round(round_spec, game) {
	if (round_spec == undefined){
		console.log("no round_spec provided");
		return;
	}
	
  this.game = game;
	this.spec = round_spec;
  this.resources = round_spec.get("resources", game) || [];
  this.prompt = round_spec.get("prompt", game);
  this.pointValue = round_spec.get("value", game) || 1;
  this.max_time = round_spec.get("max_time", game) || 3000;
	this.played_round = {}; // to store data of what happened in the round.

  // event names start with lower case. 
  // state names start with upper case, so their callback names will be camel-case (eg; onPlayEvidenceCard)
	this.events = [
        { name: 'start',        from: 'none',                                    to: 'PresentRound' },
        { name: 'ask',        	from: 'PresentRound',                            to: 'GiveSituationCard' },
        { name: 'wait',         from: 'GiveSituationCard',                       to: 'WaitForPlayer' },
        { name: 'respond',      from: 'WaitForPlayer',                           to: 'UserResponds' },
        { name: 'pass',		      from: 'WaitForPlayer',                           to: 'UserPasses' },
        { name: 'evaluate',     from: 'UserResponds',                            to: 'EvaluateResponse' },
        { name: 'correct',      from: 'EvaluateResponse',                        to: 'CorrectResponse' },
        { name: 'incorrect',    from: 'EvaluateResponse',                        to: 'IncorrectResponse' },
        { name: 'timeout',      from: 'WaitForPlayer',                           to: 'IncorrectResponse' },
        { name: 'advance',      from: ['CorrectResponse','IncorrectResponse'],   to: 'end' }
     ];

	
	// INTIALIZING THE ROUND.
	var round_initer = round_spec.get("InitializeRound");
	if (round_initer){
		// adjust any of the default values,
		// or add data or functions to the Round object,
		// and/or alter the events used to create the StateMachine.
		round_initer.apply(this, game);
	}

  // create a StateMachine to track what user can do in various situations.
  $.extend(this, StateMachine.create({
    events: this.events
   }));

  this.onbeforestart = function(eventname, from, to){
    this.game.sendMessage("Starting Round "+this.game.round_nbr);
		var round = this;
		// record the start time of the round.
		window.reporter.addData({ round_nbr: this.game.round_nbr, event: "start of round" })
	}

  this.onWaitForPlayer = function(){
    this.game.startClock(this.max_time);
  }

	// doing a little more cleanup now, before we issue the ruling.
	this.onbeforeevaluate = function(){
    this.game.stopClock();
	}

	//  user 'passes' on their turn.
	this.onbeforepass = function(){	
    this.game.stopClock();
	}
	
	this.onEvaluateResponse = function(){
		// s/b custom. find user response and compare to some stored values.
		// this is a stub, to be replaced by a round_initer function in the YAML game spec. 
		var correct = true;
		if (correct) {
			this.correct();
		} else {
			this.incorrect();
		}
  }

	this.onleaveEvaluateResponse = function(eventname, from, to){
    this.ruling_card = $(createCard(eventname.capitalize().past_tense() + ".", "", "ruling", "#questions"));
		// no animation. just hold on the ruling long enough for the user to read it.
		setTimeout(this.transition.bind(this), 2000);
    
		return StateMachine.ASYNC;
	}

  this.onRejectEvidence = function(){
    this.advance();
  }

  this.onAdmitEvidence = function(){
    this.game.addPoints(this.pointValue);
    this.game.sendMessage("\'"+this.argument+"\'");
    this.advance(); 
  }
  
  this.onbeforetimeout = function(){
    this.game.sendMessage("ran out of time.");
    this.game.stopClock();
  }

  this.onbeforeadvance = function(){
		try{
			// write out the user data.
			window.reporter.addData(this.played_round)
			
		} catch(e){ console.log(e) }
  }
  this.onend = function(){
    defer(this.game.newRound, this.game);
  }
}