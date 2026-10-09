import askingForDirections from "./dialogues/asking-for-directions.mjs";
import atAHotel from "./dialogues/at-a-hotel.mjs";
import coffeeShop from "./dialogues/coffee-shop.mjs";
import groceryStore from "./dialogues/grocery-store.mjs";
import restaurant from "./dialogues/restaurant.mjs";
import walkInThePark from "./dialogues/walk-in-the-park.mjs";
import weekendCamping from "./dialogues/weekend-camping.mjs";
import tenMinutesADay from "./stories/ten-minutes-a-day.mjs";
import theLostWallet from "./stories/the-lost-wallet.mjs";
import grateful from "./stories/grateful.mjs";

export const dialogueCourseConfigs = [
	weekendCamping,
	askingForDirections,
	coffeeShop,
	atAHotel,
	groceryStore,
	restaurant,
	walkInThePark,
];

export const storyCourseConfigs = [tenMinutesADay, theLostWallet, grateful];

export const courseConfigs = [...dialogueCourseConfigs, ...storyCourseConfigs];
