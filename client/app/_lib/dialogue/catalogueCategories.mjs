// Legacy Dialogue courses keep their existing categories until they declare metadata.
const legacyDialogueCategories = {
	office: ["office-introduction"],
	travel: ["at-a-hotel", "asking-for-directions", "weekend-camping"],
	food: ["coffee-shop", "grocery-store", "restaurant"],
	life: ["at-a-hotel", "weekend-camping"],
	daily: ["at-a-hotel", "asking-for-directions", "coffee-shop", "grocery-store", "restaurant", "office-introduction", "weekend-camping"],
};

export function matchesCourseCategory(course, category) {
	if (category === "all") return true;
	const categories = Array.isArray(course.categories)
		? course.categories : course.category ? [course.category] : [];
	if (course.contentType === "story") {
		return category === "story" && (!categories.length || categories.some(value => ["story", "story-of-life"].includes(value)));
	}
	if (categories.length) return categories.includes(category);
	return legacyDialogueCategories[category]?.includes(course.id) || false;
}
