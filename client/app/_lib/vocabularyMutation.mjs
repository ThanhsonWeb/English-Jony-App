import { resourceCache } from "./resourceCache.mjs";
import { cacheVocabularyChange } from "./vocabulary.mjs";

// Edits, reviews and deletes of one word share an order across route remounts.
export function createVocabularyMutationClient({ cache = resourceCache, request = (...args) => fetch(...args) } = {}) {
	const pending = new Map();
	return function mutateVocabulary({ userId, id, method = "PATCH", body, topicId, review = false }) {
		const session = cache.captureActiveSession();
		const key = `${session.userId}:${id || "create"}`;
		const previous = pending.get(key) || Promise.resolve();
		const mutation = previous.catch(() => {}).then(async () => {
			if (!cache.isActiveSession(session) || (userId && session.userId !== userId)) throw new Error("Vocabulary session changed");
			const response = await request(`/api/v1/vocab${id ? `/${encodeURIComponent(id)}` : ""}${review ? "/review" : ""}`, {
				method, credentials: "include", ...(review ? { keepalive: true } : {}),
				...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
			});
			if (!response.ok) {
				if (response.status === 401 && cache.isActiveSession(session)) cache.clearAllPrivate();
				throw Object.assign(new Error("Vocabulary was not saved"), { status: response.status });
			}
			const payload = method === "DELETE" ? null : await response.json();
			const word = payload?.data?.updatedVocab || payload?.data?.newVocab;
			if (method !== "DELETE" && !word?._id) throw new Error("Vocabulary confirmation is missing");
			if (!cache.isActiveSession(session)) throw new Error("Vocabulary session changed");
			if (word?.user && String(word.user?._id || word.user) !== session.userId) throw new Error("Vocabulary belongs to another account");
			cacheVocabularyChange(session.userId, { word, id, topicId, remove: method === "DELETE" }, cache);
			if (review) {
				cache.invalidate(session.userId, "study-activities");
				cache.invalidatePrefix(session.userId, "leaderboard:");
			}
			return word;
		});
		pending.set(key, mutation);
		void mutation.finally(() => { if (pending.get(key) === mutation) pending.delete(key); }).catch(() => {});
		return mutation;
	};
}

export const mutateVocabulary = createVocabularyMutationClient();
