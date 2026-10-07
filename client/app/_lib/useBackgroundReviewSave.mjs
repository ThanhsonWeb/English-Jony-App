"use client";

import { useState, useSyncExternalStore } from "react";
import { createReviewSaveController } from "./reviewSaveController.mjs";

async function sendReview(wordId, input) {
	const response = await fetch(`/api/v1/vocab/${wordId}/review`, {
		method: "POST",
		credentials: "include",
		keepalive: true,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!response.ok) throw new Error("Review save failed");
}

export function useBackgroundReviewSave() {
	const [controller] = useState(() => createReviewSaveController(sendReview));
	const { pending, failed } = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);
	return { ...controller, pending, failed };
}
