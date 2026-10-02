"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/app/_contexts/AuthContext";
import {
	getDialoguePlaybackRateSnapshot,
	getServerDialoguePlaybackRateSnapshot,
	subscribeToDialoguePlaybackRate,
} from "@/app/_lib/dialogue/playbackRate.mjs";

export default function useDialoguePlaybackRate() {
	const { user } = useAuth();
	const userId = user?._id || user?.id || null;
	const subscribe = useCallback(
		(onChange) => subscribeToDialoguePlaybackRate(userId, onChange),
		[userId],
	);
	const getSnapshot = useCallback(
		() => getDialoguePlaybackRateSnapshot(userId),
		[userId],
	);

	return useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerDialoguePlaybackRateSnapshot,
	);
}
