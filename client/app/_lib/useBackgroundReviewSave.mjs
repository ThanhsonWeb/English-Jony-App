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
	if (!input.practice) {
		void fetch("/api/v1/study-activities", {
			method: "POST", credentials: "include", keepalive: true,
		}).catch(() => {});
	}
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
