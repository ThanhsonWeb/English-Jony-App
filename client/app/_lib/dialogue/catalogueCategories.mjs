// Legacy Dialogue courses keep their existing categories until they declare metadata.
const legacyDialogueCategories = {
	office: ["office-introduction"],
	travel: ["at-a-hotel", "asking-for-directions", "weekend-camping"],
	food: ["coffee-shop", "grocery-store", "restaurant"],
};

export function getCourseCategory(course) {
	if (!course) return "other";
	const categories = Array.isArray(course.categories) ? course.categories : course.category ? [course.category] : [];
	if (categories.length) return categories[0] === "story-of-life" ? "story" : categories[0];
	if (course.contentType === "story") return "story";
	const legacyCategory = Object.keys(legacyDialogueCategories).find(category => legacyDialogueCategories[category].includes(course.id));
	return legacyCategory === "office" ? "other" : legacyCategory || "other";
}

export function matchesCourseCategory(course, category) {
	if (category === "all") return true;
	const categories = Array.isArray(course.categories)
		? course.categories : course.category ? [course.category] : [];
	if (course.contentType === "story") {
		if (category === "anime") return categories.includes("anime");
		if (category === "story") {
			return !categories.includes("anime") && (!categories.length || categories.some(value => ["story", "story-of-life"].includes(value)));
		}
		return false;
	}
	if (categories.length) return categories.includes(category);
	return legacyDialogueCategories[category]?.includes(course.id) || false;
}
