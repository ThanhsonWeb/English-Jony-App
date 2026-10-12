import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesCourseCategory } from "../../../app/_lib/dialogue/catalogueCategories.mjs";
import tenMinutesConfig from "../../config/stories/ten-minutes-a-day.mjs";
import narutoSeason1Config from "../../config/anime/naruto-season-1.mjs";
const futureStoryConfig = { courseId: "future-story", contentType: "story", category: "story-of-life" };
test("Story category includes Story of Life and Anime metadata", () => {
	for (const config of [tenMinutesConfig, futureStoryConfig, narutoSeason1Config]) {
		const course = { ...config, id: config.courseId };
		assert.equal(matchesCourseCategory(course, "story"), true);
		for (const category of ["food", "travel", "daily", "life", "office"]) assert.equal(matchesCourseCategory(course, category), false);
	}
	assert.equal(matchesCourseCategory({ id: "any-new-story", contentType: "story" }, "story"), true);
	assert.equal(matchesCourseCategory({ id: "weekend-camping" }, "story"), false);
});
test("existing Dialogue memberships are preserved", () => {
	const memberships = {
		"coffee-shop": ["food", "daily"], "grocery-store": ["food", "daily"], "restaurant": ["food", "daily"],
		"asking-for-directions": ["travel", "daily"], "at-a-hotel": ["travel", "life", "daily"],
		"office-introduction": ["office", "daily"], "weekend-camping": ["travel", "life", "daily"],
	};
	for (const [id, expected] of Object.entries(memberships)) {
		for (const category of ["office", "travel", "food", "life", "daily", "story"]) assert.equal(matchesCourseCategory({ id }, category), expected.includes(category), `${id}/${category}`);
	}
});
test("declared category/categories metadata supports future Dialogue courses", () => {
	assert.equal(matchesCourseCategory({ id: "future-dialogue", category: "travel" }, "travel"), true);
	assert.equal(matchesCourseCategory({ id: "future-dialogue", categories: ["life", "daily"] }, "daily"), true);
	assert.equal(matchesCourseCategory({ id: "unknown" }, "all"), true);
	assert.equal(matchesCourseCategory({ id: "unknown" }, "story"), false);
});
test("filtering the active catalogue never activates unpublished courses", () => {
	const catalogue = JSON.parse(readFileSync(new URL("../../../../server/data/dialogueTaskCatalogue.json", import.meta.url)));
	const ids = [...new Set(catalogue.map(([id]) => id))];
	assert.ok(ids.includes("ten-minutes-a-day"));
	assert.ok(!ids.includes("weekend-camping"));
	const active = ids.map(id => id === tenMinutesConfig.courseId ? { ...tenMinutesConfig, id } : { id });
	assert.deepEqual(active.filter(course => matchesCourseCategory(course, "story")).map(course => course.id), ["ten-minutes-a-day"]);
});
