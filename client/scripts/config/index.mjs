import askingForDirections from "./dialogues/asking-for-directions.mjs";
import atAHotel from "./dialogues/at-a-hotel.mjs";
import coffeeShop from "./dialogues/coffee-shop.mjs";
import groceryStore from "./dialogues/grocery-store.mjs";
import restaurant from "./dialogues/restaurant.mjs";
import walkInThePark from "./dialogues/walk-in-the-park.mjs";
import weekendCamping from "./dialogues/weekend-camping.mjs";
import tenMinutesADay from "./stories/ten-minutes-a-day.mjs";
import grateful from "./stories/grateful.mjs";
import aSmallSurprise from "./stories/a-small-surprise.mjs";
import theBoyWhoWasAfraidToFall from "./stories/the-boy-who-was-afraid-to-fall.mjs";
import aLittleLie from "./stories/a-little-lie.mjs";
import narutoSeason1 from "./anime/naruto-season-1.mjs";

export const dialogueCourseConfigs = [
	weekendCamping,
	askingForDirections,
	coffeeShop,
	atAHotel,
	groceryStore,
	restaurant,
	walkInThePark,
];

export const storyCourseConfigs = [
	tenMinutesADay,
	grateful,
	aSmallSurprise,
	theBoyWhoWasAfraidToFall,
	aLittleLie,
	narutoSeason1,
];

export const courseConfigs = [...dialogueCourseConfigs, ...storyCourseConfigs];
