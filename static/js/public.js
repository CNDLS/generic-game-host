$(document).ready(function () {
	var header = $(".headerWrapper");
	var spacer = $(".spacer");
	var logo = $(".logo");
	var navContainer = $(".navContainer");

	$(window).scroll(function () {
		var scroll = $(window).scrollTop();

		if (scroll >= 30) {
      // header.addClass("smaller");
      // spacer.addClass("smaller");
      // logo.addClass("smaller");
      // navContainer.addClass("smaller");
		}

		else {
      header.removeClass("smaller");
      spacer.removeClass("smaller");
      logo.removeClass("smaller");
      navContainer.removeClass("smaller");
		}
	});
});