import askingForDirectionsCourse from "./courses/asking-for-directions";
import atAHotelCourse from "./courses/at-a-hotel";
import coffeeShopCourse from "./courses/coffee-shop";
import groceryStoreCourse from "./courses/grocery-store";
import officeIntroductionCourse from "./courses/office-introduction";
import restaurantCourse from "./courses/restaurant";
import weekendCampingCourse from "./courses/weekend-camping";

export const lessonData = {
   [atAHotelCourse.id]: atAHotelCourse,
   [officeIntroductionCourse.id]: officeIntroductionCourse,
   [weekendCampingCourse.id]: weekendCampingCourse,
   [askingForDirectionsCourse.id]: askingForDirectionsCourse,
   [coffeeShopCourse.id]: coffeeShopCourse,
   [groceryStoreCourse.id]: groceryStoreCourse,
   [restaurantCourse.id]: restaurantCourse,
};
