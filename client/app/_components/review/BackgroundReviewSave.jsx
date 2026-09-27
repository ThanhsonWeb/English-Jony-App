"use client";

import { getReviewSaveNoticeText } from "@/app/_lib/reviewSaveController.mjs";
import { ReviewStatus } from "./ReviewLayout";

export { useBackgroundReviewSave } from "@/app/_lib/useBackgroundReviewSave.mjs";

export function ReviewSaveNotice({ pending, failed }) {
	const message = getReviewSaveNoticeText({ pending, failed });
	if (!message) return null;

	return (
		<div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-slate-700 bg-[#101c38] px-4 py-2 text-sm text-slate-200 shadow-xl sm:left-auto sm:right-6">
			{message}
		</div>
	);
}

export function ReviewPendingCompletion({ pending, failed, onBack }) {
	return <>
		<ReviewStatus
			title="Đang lưu tiến độ"
			message={`Còn ${pending} từ đang được lưu. Bạn có thể quay lại danh sách từ.`}
			onBack={onBack}
		/>
		<ReviewSaveNotice pending={pending} failed={failed} />
	</>;
}
