/*
 * Reporting mechanism. Refactored for simplicity. Need to be able to work into a grunt build process, eventually.
 */

function S4 () {
	return (((1 + Math.random()) * 0x10000)|0).toString(16).substring(1);
}

function guid () {
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function Reporter (default_data, sessionID) {
	if ($ === undefined) { return; }
	this.script_tag = $("script#reporter");
	if (this.script_tag.length === 0) { return; }
	this.report_url = this.script_tag.attr("report-to");
	this.csrftoken = this.script_tag.attr("csrftoken");
	this.user_data = [];
	this.default_data = default_data || {};
	this.sessionID = sessionID || guid();

	this.addData = function (addl_data) {
		$.extend(addl_data, { timeStamp: Date.now() });
		this.user_data.push(addl_data);
	};

	this.sendReport = function (on_success) {
		// some defaults. always add a reference to the session.
		this.user_data.unshift($.extend(this.default_data, { session: this.sessionID }));

		var reporter = this;
		var headers = {};
		if (this.csrftoken !== undefined) {
			headers["X-CSRFToken"] = this.csrftoken;
		}
		$.ajax({
			url: this.report_url,
			type: "POST",
			dataType: "json",
			data: JSON.stringify(this.user_data),
			headers: headers,
			success: function (/* data, textStatus, xhr */) {
				// only nuke the user_data once we're sure it has been recieved. 
				// this way, if we see multiple copies of the session object, we know some connection attempts have failed.
				reporter.user_data = [];
				if (on_success && (typeof on_success === "function")) {
					on_success.call();
				}
			},
			error: function (xhr, error_name, error) {
				console.error(xhr, error_name, error.stack);
			}
		});
	};
}

  
/*
* Initialization.
*/

$(function () {
	in_production_try(window,
		function () {
			window.reporter = new Reporter();
		},
		function () {
			// a dummy, so we can still play the game, even if for some reason we can't report results.
			window.reporter = function () {
				this.addData = function (addl_data) {
					console.warn("Not recording:", add_data);
				}
				this.sendReport = function (on_success) {
					console.warn("Not reporting, just moving on.");
					on_success.call();
				}
			};
		}
	);
});