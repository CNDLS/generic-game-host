/*
 * Reporting mechanism. Refactored for simplicity. Need to be able to work into a grunt build process, eventually.
 */

/* FAILSAFE */
Game = Game || function () {};


function S4 () {
	return (((1 + Math.random()) * 0x10000)|0).toString(16).substring(1);
}

function guid () {
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

Game.Reporter = function (game) {
	this.game = game;
	this.user_data = [];
	this.sessionID = guid();
};

Game.Reporter.prototype.setURL = function (url, csrf_token) {
	this.report_url = url;
	this.csrftoken = csrf_token;
}

Game.Reporter.prototype.setSessionID = function (sessionID) {
	// for when we implement returning to saved games.
	this.sessionID = sessionID;
}

Game.Reporter.prototype.addData = function (addl_data) {
	$.extend(addl_data, { timeStamp: Date.now() });
	this.user_data.push(addl_data);
};

Game.Reporter.prototype.sendReport = function () {
	// some defaults. always add a reference to the session.
	this.user_data.unshift({ session: this.sessionID });
	var reporter = this;
	var headers = {};
	if (this.csrftoken !== undefined) {
		headers["X-CSRFToken"] = this.csrftoken;
	}
	
	console.log((this.user_data))
	
	var dfd = $.Deferred();
	dfd.resolve();
	return dfd.promise();
	// return $.ajax({
	// 	url: this.report_url,
	// 	type: "POST",
	// 	dataType: "json",
	// 	data: JSON.stringify(this.user_data),
	// 	headers: headers,
	// 	success: function (data, textStatus, xhr) {
	// 		// only nuke the user_data once we're sure it has been recieved.
	// 		// this way, if we see multiple copies of the session object, we know some connection attempts have failed.
	// 		reporter.user_data = [];
	// 	},
	// 	error: function (xhr, error_name, error) {
	// 		console.error(xhr, error_name, error.stack);
	// 	}
	// });
};


Game.NullReporter = function () {}
Game.NullReporter.prototype.setURL = function (url, csrf_token) {};
Game.Reporter.prototype.setSessionID = function (sessionID) {};
Game.NullReporter.prototype.addData = function (addl_data) {};
Game.NullReporter.prototype.sendReport = function (on_success) {
	if (typeof on_success === "function") { on_success.call(); }
};