/**********************************************/
/* Game utitilies. We should be able to add some of these for the user. */
/**********************************************/
Game.everyNTimes = function(n, return_value, default_value){
	if (Math.trunc(Math.random() * n) % n === 0) {
		return return_value;
	} else {
		return default_value;
	}
}