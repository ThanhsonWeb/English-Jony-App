import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
	getContentStorageDirectory,
	getCourseConfigPath,
	getDialogueDataJsonPath,
	getGeneratedDialogueDraftPath,
	getPublicAssetDirectory,
	getPublicAssetPath,
} from "../../lib/dialogue-content-paths.mjs";

const root = path.join("C:/", "studyjony", "client");

test("normal dialogue content keeps the existing storage paths", () => {
	assert.equal(getContentStorageDirectory(), "dialogues");
	assert.equal(
		getGeneratedDialogueDraftPath(root, undefined, "coffee-shop", "ordering-a-coffee"),
		path.join(root, "generated", "dialogues", "coffee-shop", "ordering-a-coffee", "draft.json"),
	);
	assert.equal(
		getDialogueDataJsonPath(root, "dialogue", "coffee-shop", "ordering-a-coffee"),
		path.join(root, "app", "[locale]", "(main)", "dialogue", "_data", "dialogues", "coffee-shop", "ordering-a-coffee.json"),
	);
});

test("story content uses separate generated and lesson-data directories", () => {
	assert.equal(getContentStorageDirectory("story"), "stories");
	assert.equal(
		getGeneratedDialogueDraftPath(root, "story", "ten-minutes-a-day", "the-old-book"),
		path.join(root, "generated", "stories", "ten-minutes-a-day", "the-old-book", "draft.json"),
	);
	assert.equal(
		getDialogueDataJsonPath(root, "story", "ten-minutes-a-day", "the-old-book"),
		path.join(root, "app", "[locale]", "(main)", "dialogue", "_data", "stories", "ten-minutes-a-day", "the-old-book.json"),
	);
});

test("rejects unknown content types instead of writing to a wrong folder", () => {
	assert.throws(() => getContentStorageDirectory("course"), /Unsupported dialogue contentType/);
	assert.throws(() => getPublicAssetPath("course", "course-id", "scene.png"), /Unsupported dialogue contentType/);
});

test("public assets follow each course content type", () => {
	assert.equal(getPublicAssetDirectory("dialogue"), "dialogue");
	assert.equal(getPublicAssetDirectory("story"), "stories");
	assert.equal(
		getPublicAssetPath("dialogue", "coffee-shop", "ordering-a-coffee", "audio", "maria-01.mp3"),
		"/dialogue/coffee-shop/ordering-a-coffee/audio/maria-01.mp3",
	);
	assert.equal(
		getPublicAssetPath("story", "ten-minutes-a-day", "the-old-book", "bg.png"),
		"/stories/ten-minutes-a-day/the-old-book/bg.png",
	);
});

test("keeps configs separated by the course content type", () => {
	assert.equal(
		getCourseConfigPath(root, "dialogue", "coffee-shop"),
		path.join(root, "scripts", "config", "dialogues", "coffee-shop.mjs"),
	);
	assert.equal(
		getCourseConfigPath(root, "story", "ten-minutes-a-day"),
		path.join(root, "scripts", "config", "stories", "ten-minutes-a-day.mjs"),
	);
});
