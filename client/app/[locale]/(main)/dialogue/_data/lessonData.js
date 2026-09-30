import askingForDirectionsCourse from "./courses/asking-for-directions";
import atAHotelCourse from "./courses/at-a-hotel";
import coffeeShopCourse from "./courses/coffee-shop";
import groceryStoreCourse from "./courses/grocery-store";
import officeIntroductionCourse from "./courses/office-introduction";
import restaurantCourse from "./courses/restaurant";
import weekendCampingCourse from "./courses/weekend-camping";
import { withDialogueLocalization } from "@/app/_lib/dialogue/localization";

export const lessonData = {
   // [atAHotelCourse.id]: withDialogueLocalization(atAHotelCourse),
   // [officeIntroductionCourse.id]: withDialogueLocalization(officeIntroductionCourse),
   // [weekendCampingCourse.id]: withDialogueLocalization(weekendCampingCourse),
   [askingForDirectionsCourse.id]: withDialogueLocalization(askingForDirectionsCourse),
   [coffeeShopCourse.id]: withDialogueLocalization(coffeeShopCourse),
   [groceryStoreCourse.id]: withDialogueLocalization(groceryStoreCourse),
   [restaurantCourse.id]: withDialogueLocalization(restaurantCourse),
};
