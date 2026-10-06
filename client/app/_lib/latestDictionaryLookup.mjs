export function createLatestDictionaryLookup({ lookup, onResult, onError, onLoading }) {
	let requestId = 0;
	let controller;
	function cancel(notify = true) {
		requestId += 1;
		controller?.abort();
		if (notify) { onLoading(false); onError(false); }
	}
	return {
		cancel,
		async run(word) {
			cancel(false);
			const id = requestId;
			controller = new AbortController();
			onError(false);
			onLoading(true);
			try {
				const result = await lookup(word, controller.signal);
				if (id === requestId) onResult(result);
			} catch {
				if (id === requestId) onError(true);
			} finally {
				if (id === requestId) onLoading(false);
			}
		},
	};
}

export async function lookupDictionaryWord(word, signal) {
	const response = await fetch(`/api/v1/dictionary/${encodeURIComponent(word)}`, { credentials: "include", signal });
	if (!response.ok) throw new Error("Dictionary lookup failed");
	return (await response.json()).data;
}
