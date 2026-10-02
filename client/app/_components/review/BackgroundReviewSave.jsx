"use client";

import { ReviewStatus } from "./ReviewLayout";
import { useTranslations } from "next-intl";

export { useBackgroundReviewSave } from "@/app/_lib/useBackgroundReviewSave.mjs";

export function ReviewSaveNotice({ pending, failed }) {
	const t = useTranslations("WordlistReview.common");
	const message = failed > 0
		? t("saveFailed", { count: failed })
		: pending > 0
			? t("savingNotice", { count: pending })
			: "";
	if (!message) return null;

	return (
		<div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-slate-700 bg-[#101c38] px-4 py-2 text-sm text-slate-200 shadow-xl sm:left-auto sm:right-6">
			{message}
		</div>
	);
}

export function ReviewPendingCompletion({ pending, failed, onBack }) {
	const t = useTranslations("WordlistReview.common");

	return <>
		<ReviewStatus
			title={t("savingTitle")}
			message={t("savingMessage", { count: pending })}
			onBack={onBack}
		/>
		<ReviewSaveNotice pending={pending} failed={failed} />
	</>;
}
