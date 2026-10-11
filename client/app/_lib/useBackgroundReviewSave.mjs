"use client";

import { useState, useSyncExternalStore } from "react";
import { createReviewSaveController } from "./reviewSaveController.mjs";
import { mutateVocabulary } from "./vocabularyMutation.mjs";

export function useBackgroundReviewSave() {
	const [controller] = useState(() => createReviewSaveController((wordId, input) =>
		mutateVocabulary({ id: wordId, method: "POST", body: input, review: true })));
	const { pending, failed } = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);
	return { ...controller, pending, failed };
}
