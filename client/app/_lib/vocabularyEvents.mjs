const SAVE_EVENT = "vocabulary-saved";
import { cacheVocabularyChange } from "./vocabulary.mjs";

export function notifyVocabularySaved(userId, word) {
	if (word?._id) cacheVocabularyChange(userId, { word });
	window.dispatchEvent(new CustomEvent(SAVE_EVENT, { detail: { userId, word } }));
}

export function subscribeVocabularySaved(userId, topicId, reload) {
	function onSave({ detail }) {
		if (!userId || detail?.userId !== userId) return;
		const topic = detail.word?.topic?._id || detail.word?.topic;
		if (topicId && topic !== topicId) return;
		reload();
	}
	window.addEventListener(SAVE_EVENT, onSave);
	return () => window.removeEventListener(SAVE_EVENT, onSave);
}
