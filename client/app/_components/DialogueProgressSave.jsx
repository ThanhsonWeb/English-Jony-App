"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/app/_contexts/AuthContext";
import { createDialogueProgressSaveController, createDialogueAttemptClient } from "@/app/_lib/dialogueProgressSave.mjs";

const ProgressContext = createContext(null);
export const DialogueProgressProvider = ProgressContext.Provider;
export const useDialogueProgress = () => useContext(ProgressContext);

export function useDialogueProgressSave(path) {
	const router = useRouter();
	const { loading, captureSession, isCurrentSession } = useAuth();
	const { generation, userId } = captureSession();
	const controller = useMemo(() => {
		const attempt = createDialogueAttemptClient(path);
		const save = createDialogueProgressSaveController(
			(signal, input) => attempt.save(signal, input),
			{
				isCurrent: () => isCurrentSession({ generation, userId }),
				onSaved(progress) {
					window.dispatchEvent(new CustomEvent("dialogue-progress-updated", { detail: progress }));
					router.refresh();
				},
			},
		);
		return { ...save, prepare: attempt.prepare, cancel() { save.cancel(); attempt.cancel(); } };
	}, [path, generation, userId, isCurrentSession, router]);
	const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
	useEffect(() => {
		if (!loading && userId) void controller.prepare().catch(() => {});
		return () => controller.cancel();
	}, [controller, loading, userId]);
	return {
		...snapshot,
		loading,
		getStatus: () => controller.getSnapshot().status,
		save: input => loading ? Promise.resolve(false) : userId ? controller.save(input) : Promise.resolve(true),
	};
}

export function DialogueProgressNotice() {
	const progress = useDialogueProgress();
	const t = useTranslations("DialogueFeature");
	if (!progress || !["saving", "error"].includes(progress.status)) return null;
	const failed = progress.status === "error";
	return (
		<div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-8">
			<div role={failed ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${failed ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-app bg-surface text-secondary"}`}>
				<p>{t(failed ? "progressSaveFailed" : "progressSaving")}</p>
				{failed && <button type="button" onClick={() => progress.save()} className="min-h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover">{t("retryProgressSave")}</button>}
			</div>
		</div>
	);
}

export function DialogueProgressLink({ ref, href, onClick, requireSave = true, children, ...props }) {
	const progress = useDialogueProgress();
	const router = useRouter();
	const t = useTranslations("DialogueFeature");
	if (!progress) return <Link ref={ref} href={href} onClick={onClick} {...props}>{children}</Link>;
	if (requireSave && progress.status === "error") {
		return <button ref={ref} type="button" {...props} title={t("progressSaveFailed")} onClick={() => {
			if (progress.getStatus() === "error") progress.save();
		}}>
			<span className="block text-xs font-normal">{t("progressNotSaved")}</span>
			<span className="block">{t("retryProgressSave")}</span>
		</button>;
	}
	if (progress.loading || ["saving", "error"].includes(progress.status)) {
		return <button ref={ref} type="button" disabled aria-busy={progress.status === "saving"} {...props}>{requireSave && progress.status === "saving" ? t("progressSaving") : children}</button>;
	}
	return <Link ref={ref} href={href} {...props} onClick={async event => {
		if (["saving", "error"].includes(progress.getStatus())) { event.preventDefault(); return; }
		if (!requireSave || (!onClick && progress.getStatus() === "saved")) return;
		event.preventDefault();
		const saved = await (onClick ? onClick() : progress.save());
		if (saved) router.push(href);
	}}>{children}</Link>;
}
