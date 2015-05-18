$(function(){
  $("#game_list li a").click(function(){
		// highlight only clicked link.
		$("#game_list li a").removeClass("selected");
		$(this).addClass("selected");
    $("#explanation.dialog").html( $("#description_"+ $(this).attr("game_nbr")) );
    return false;
  });
});