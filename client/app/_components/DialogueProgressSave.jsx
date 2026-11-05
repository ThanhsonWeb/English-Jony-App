"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/app/_contexts/AuthContext";
import { createDialogueProgressQueue, emptyProgressQueue, progressQueuePrefix } from "@/app/_lib/dialogueProgressQueue.mjs";
import { isNewDialogueXpAward } from "@/app/_lib/dialogueProgressSave.mjs";
import { cacheStudyProgress } from "@/app/_lib/cacheStudyProgress.mjs";

const ProgressContext = createContext(null);
const BackgroundContext = createContext(null);
const noSubscribe = () => () => {};
const emptySnapshot = () => emptyProgressQueue;
export const DialogueProgressProvider = ProgressContext.Provider;
export const useDialogueProgress = () => useContext(ProgressContext);

// Lives above exercise routes so navigation does not cancel completed work.
export function DialogueBackgroundProgressProvider({ children }) {
	const { loading, captureSession, isCurrentSession } = useAuth();
	const t = useTranslations("DialogueFeature");
	const { generation, userId } = captureSession();
	const [xpReward, setXpReward] = useState(null);
	const queue = useMemo(() => userId ? createDialogueProgressQueue({
		userId,
		storage: () => window.localStorage,
		locks: () => navigator.locks,
		isCurrent: () => isCurrentSession({ generation, userId }),
		onSaved: (progress, xp) => {
			if (!isCurrentSession({ generation, userId })) return;
			cacheStudyProgress(userId, progress);
			window.dispatchEvent(new CustomEvent("dialogue-progress-updated", { detail: progress }));
			if (isNewDialogueXpAward(xp)) {
				setXpReward(reward => ({ generation, userId,
					amount: reward?.generation === generation && reward.userId === userId ? reward.amount + xp.awarded : xp.awarded }));
			}
		},
	}) : null, [generation, userId, isCurrentSession]);
	const snapshot = useSyncExternalStore(queue?.subscribe || noSubscribe, queue?.getSnapshot || emptySnapshot, emptySnapshot);
	useEffect(() => {
		if (loading || !queue) return;
		queue.start();
		const retry = () => queue.retry();
		const sync = event => { if (event.key === null || event.key?.startsWith(progressQueuePrefix(userId))) queue.sync(); };
		const visible = () => { if (document.visibilityState === "visible") queue.retry(); };
		window.addEventListener("online", retry);
		window.addEventListener("pageshow", retry);
		window.addEventListener("storage", sync);
		document.addEventListener("visibilitychange", visible);
		return () => {
			window.removeEventListener("online", retry);
			window.removeEventListener("pageshow", retry);
			window.removeEventListener("storage", sync);
			document.removeEventListener("visibilitychange", visible);
			queue.stop();
		};
	}, [queue, loading, userId]);
	useEffect(() => {
		if (!snapshot.pendingCount) return;
		const warn = event => { event.preventDefault(); event.returnValue = ""; };
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [snapshot.pendingCount]);
	useEffect(() => {
		if (!xpReward || xpReward.generation !== generation || xpReward.userId !== userId) return;
		const timer = setTimeout(() => setXpReward(null), 3500);
		return () => clearTimeout(timer);
	}, [xpReward, generation, userId]);
	return <BackgroundContext.Provider value={{ queue, snapshot, loading, userId }}>{children}
		{xpReward?.generation === generation && xpReward.userId === userId && xpReward.amount > 0 && <div role="status" aria-live="polite" className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-1/2 z-[100] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-primary/25 bg-surface px-4 py-3 text-sm font-semibold text-main shadow-xl sm:bottom-6">
			<Sparkles size={18} aria-hidden="true" className="shrink-0 text-brand-text" />
			<span>{t("xpRewardEarned", { amount: xpReward.amount })}</span>
		</div>}
	</BackgroundContext.Provider>;
}

export function useDialogueProgressSave(path) {
	const { queue, snapshot, loading, userId } = useContext(BackgroundContext);
	// Retain a checked answer if authentication is still being restored.
	const submissionRef = useRef({ path });
	useEffect(() => {
		if (submissionRef.current.path !== path) submissionRef.current = { path };
		const submission = submissionRef.current;
		if (loading || !queue) return;
		queue.beginTask(path);
		void queue.prepare(path).catch(() => {});
		if (submission.input && !submission.queue && (!submission.owner || submission.owner === userId)) {
			submission.queue = queue; submission.owner = userId;
			queue.enqueue(path, submission.input);
		}
	}, [queue, loading, path, userId]);
	return {
		status: queue?.getTask(path)?.status || "idle",
		loading,
		canNavigate: !loading && snapshot.canLeave,
		canLeave: snapshot.canLeave,
		pendingCount: snapshot.pendingCount,
		async save(input) {
			if (submissionRef.current.path !== path) submissionRef.current = { path };
			const submission = submissionRef.current;
			if (input !== undefined && !submission.input) { submission.input = input; submission.owner = userId; }
			if (loading) return false;
			if (!userId) return true;
			if (submission.owner && submission.owner !== userId) return false;
			if (!submission.queue && submission.input) {
				submission.queue = queue; submission.owner = userId;
				if (queue.enqueue(path, submission.input)) return true;
			} else if (input === undefined) queue.retry();
			if (queue.getTask(path)?.status === "saved") return true;
			if (queue.getTask(path) && queue.getSnapshot().canLeave) return true;
			return queue.waitForTask(path);
		},
	};
}

export function DialogueProgressNotice() {
	const progress = useContext(BackgroundContext);
	const t = useTranslations("DialogueFeature");
	if (!progress || !progress.snapshot.requiresAttention) return null;
	const { snapshot, queue } = progress;
	const failed = snapshot.status === "error";
	return (
		<div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-8">
			<div role={failed ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2 text-sm ${failed ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-app bg-surface text-secondary"}`}>
				<p>{t(snapshot.storageError ? "progressRecoveryFailed" : !snapshot.canLeave ? "progressStorageUnavailable" : "progressSaveFailed")}</p>
				{failed && <button type="button" onClick={() => queue.retry()} className="min-h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover">{t("retryProgressSave")}</button>}
			</div>
		</div>
	);
}

export function DialogueProgressLink({ ref, href, onClick, requireSave = true, children, ...props }) {
	const progress = useDialogueProgress();
	const router = useRouter();
	const t = useTranslations("DialogueFeature");
	const navigating = useRef(false);
	if (!progress) return <Link ref={ref} href={href} onClick={onClick} {...props}>{children}</Link>;
	if (progress.loading || !progress.canNavigate) {
		return <button ref={ref} type="button" disabled={progress.loading || progress.status !== "error"} aria-busy={progress.status === "saving"} {...props} onClick={() => progress.save()}>
			{requireSave ? t(progress.status === "error" ? "retryProgressSave" : "progressNotSaved") : children}
		</button>;
	}
	return <Link ref={ref} href={href} {...props} onClick={async event => {
		if (!requireSave || !onClick) return;
		event.preventDefault();
		if (navigating.current) return;
		navigating.current = true;
		const accepted = await onClick();
		if (accepted) router.push(href);
		else navigating.current = false;
	}}>{children}</Link>;
}
