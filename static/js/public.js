$(document).ready(function () {
	var header = $(".header");
	var logo = $("#logo");
	var mainNav = $(".main-nav");
	var mainwrap = $(".main-wrap");

	$(window).scroll(function () {
		var scroll = $(window).scrollTop();

		if (scroll >= 30) {
			// header.removeClass("full");
			header.addClass("smaller");
		}
		else {
			header.removeClass("smaller");
			// header.addClass("full");
		}
	});
});