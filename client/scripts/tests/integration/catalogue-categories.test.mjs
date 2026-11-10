import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesCourseCategory } from "../../../app/_lib/dialogue/catalogueCategories.mjs";
import tenMinutesConfig from "../../config/stories/ten-minutes-a-day.mjs";
import narutoSeason1Config from "../../config/anime/naruto-season-1.mjs";
import conanSeason1Config from "../../config/anime/conan-season-1.mjs";
const futureStoryConfig = { courseId: "future-story", contentType: "story", category: "story-of-life" };
test("Story of Life and Anime remain separate categories", () => {
	for (const config of [tenMinutesConfig, futureStoryConfig]) {
		const course = { ...config, id: config.courseId };
		assert.equal(matchesCourseCategory(course, "story"), true);
		assert.equal(matchesCourseCategory(course, "anime"), false);
		for (const category of ["food", "travel", "office"]) assert.equal(matchesCourseCategory(course, category), false);
	}
	const animeCourses = [narutoSeason1Config, conanSeason1Config].map(config => ({ ...config, id: config.courseId }));
	assert.deepEqual(animeCourses.filter(course => matchesCourseCategory(course, "anime")).map(course => course.id), ["naruto-season-1", "conan-season-1"]);
	assert.equal(animeCourses.filter(course => matchesCourseCategory(course, "anime")).length, 2);
	for (const course of animeCourses) assert.equal(matchesCourseCategory(course, "story"), false);
	for (const [filename, configName] of [["naruto-season-1.js", "narutoSeason1Config"], ["conan-season-1.js", "conanSeason1Config"]]) {
		const courseSource = readFileSync(new URL(`../../../app/[locale]/(main)/dialogue/_data/courses/${filename}`, import.meta.url), "utf8");
		assert.match(courseSource, new RegExp(`category: ${configName}\\.category`));
	}
	const englishMessages = JSON.parse(readFileSync(new URL("../../../messages/en.json", import.meta.url), "utf8"));
	const vietnameseMessages = JSON.parse(readFileSync(new URL("../../../messages/vi.json", import.meta.url), "utf8"));
	assert.equal(englishMessages.DialogueLanding.categories.anime, "Anime");
	assert.equal(vietnameseMessages.DialogueLanding.categories.anime, "Anime");
	assert.equal(englishMessages.DialogueLanding.categories.story, "Story of Life");
	assert.equal(vietnameseMessages.DialogueLanding.categories.story, "Câu truyện");
	assert.equal("life" in englishMessages.DialogueLanding.categories, false);
	assert.equal("life" in vietnameseMessages.DialogueLanding.categories, false);
	assert.equal("daily" in englishMessages.DialogueLanding.categories, false);
	assert.equal("daily" in vietnameseMessages.DialogueLanding.categories, false);
	assert.equal(matchesCourseCategory({ id: "any-new-story", contentType: "story" }, "story"), true);
	assert.equal(matchesCourseCategory({ id: "any-new-story", contentType: "story" }, "anime"), false);
	assert.equal(matchesCourseCategory({ id: "weekend-camping" }, "story"), false);
});
test("existing Dialogue memberships are preserved", () => {
	const memberships = {
		"coffee-shop": ["food"], "grocery-store": ["food"], "restaurant": ["food"],
		"asking-for-directions": ["travel"], "at-a-hotel": ["travel"],
		"office-introduction": ["office"], "weekend-camping": ["travel"],
	};
	for (const [id, expected] of Object.entries(memberships)) {
		for (const category of ["office", "travel", "food", "anime", "story"]) assert.equal(matchesCourseCategory({ id }, category), expected.includes(category), `${id}/${category}`);
	}
});
test("declared category/categories metadata supports future Dialogue courses", () => {
	assert.equal(matchesCourseCategory({ id: "future-dialogue", category: "travel" }, "travel"), true);
	assert.equal(matchesCourseCategory({ id: "future-dialogue", categories: ["anime", "travel"] }, "travel"), true);
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
