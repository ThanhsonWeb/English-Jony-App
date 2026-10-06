import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyVocabularySaved, subscribeVocabularySaved } from "../app/_lib/vocabularyEvents.mjs";

test("saved vocabulary invalidates only the saving account's global and matching topic views", () => {
	const previous = globalThis.window;
	globalThis.window = new EventTarget();
	const calls = { global: 0, topic: 0, otherTopic: 0, otherAccount: 0, guest: 0 };
	const unsubscribe = [
		subscribeVocabularySaved("A", undefined, () => calls.global++),
		subscribeVocabularySaved("A", "topic-a", () => calls.topic++),
		subscribeVocabularySaved("A", "topic-b", () => calls.otherTopic++),
		subscribeVocabularySaved("B", undefined, () => calls.otherAccount++),
		subscribeVocabularySaved(null, undefined, () => calls.guest++),
	];
	try {
		notifyVocabularySaved("A", { _id: "one", topic: "topic-a" });
		assert.deepEqual(calls, { global: 1, topic: 1, otherTopic: 0, otherAccount: 0, guest: 0 });
		notifyVocabularySaved("A", { _id: "two" });
		notifyVocabularySaved("A", { _id: "three", topic: { _id: "topic-a" } });
		assert.deepEqual(calls, { global: 3, topic: 2, otherTopic: 0, otherAccount: 0, guest: 0 });
		unsubscribe.forEach(stop => stop());
		notifyVocabularySaved("A", { _id: "four", topic: "topic-a" });
		assert.equal(calls.global, 3, "Unmounted views no longer react");
	} finally { unsubscribe.forEach(stop => stop()); globalThis.window = previous; }
});
