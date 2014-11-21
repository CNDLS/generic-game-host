(function load(){
  var Reporter = function(default_data, sessionID){
    if ($ == undefined){ return; }
    this.script_tag = $("script#reporter");
    if (this.script_tag.length == 0){ return; }
    this.report_url = this.script_tag.attr("report-to");
    this.csrftoken = this.script_tag.attr("csrftoken");
    this.user_data = [];
    this.default_data = default_data || {};
    this.sessionID = sessionID || window.guid();
    
    this.addData = function(addl_data){
			$.extend(addl_data, { timeStamp: Date.now() });
      this.user_data.push(addl_data);
    }
    
    this.sendReport = function(on_success){
      // some defaults. always add a reference to the session.
  		this.user_data.unshift($.extend(this.default_data, { session: this.sessionID }));
  		
  		var reporter = this;
			var headers = {};
			if (this.csrftoken != undefined){ 
				headers["X-CSRFToken"] = this.csrftoken;
			}
			var jqxhr = $.ajax({
				url: this.report_url,
				type: "POST",
				dataType: "json",
				data: JSON.stringify(this.user_data),
				headers: headers,
				success: function(data, textStatus, xhr){
					// only nuke the user_data once we're sure it has been recieved. 
					// this way, if we see multiple copies of the session object, we know some connection attempts have failed.
          reporter.user_data = [];
          on_success.call();
				},
				error: function(){
					console.log(arguments)
				}
			});
      
      // in this case, we do nix user.data right after sending, because if we wait for ajax.success, we delete the start-of-round data.
    }
  }
  
  /*
   * Initialization.
   */

  $(function(){
    try {
      window.reporter = new Reporter();
    } catch(err){
      // console.log("err",err)
      throw(err)
      return;
    }
  })
})();

window.S4 = function() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
window.guid = function() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}