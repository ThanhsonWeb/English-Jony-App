"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
	ADMIN_FEEDBACK_COUNT_CHANGED_EVENT,
	readUnreadFeedbackCount,
} from "@/app/_lib/adminFeedbackNotifications.mjs";

export default function AdminFeedbackNotifications({ onNavigate }) {
	const t = useTranslations("Header");
	const router = useRouter();
	const [count, setCount] = useState(0);
	const requestSequence = useRef(0);

	const refreshCount = useCallback(async (signal) => {
		const currentRequest = ++requestSequence.current;
		try {
			const response = await fetch("/api/v1/admin/feedback/unread-count", {
				credentials: "include",
				cache: "no-store",
				signal,
			});
			if (signal?.aborted || currentRequest !== requestSequence.current) return;
			if (!response.ok) {
				setCount(0);
				return;
			}
			const payload = await response.json();
			if (signal?.aborted || currentRequest !== requestSequence.current) return;
			setCount(readUnreadFeedbackCount(payload));
		} catch (error) {
			if (error.name !== "AbortError" && currentRequest === requestSequence.current) setCount(0);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		const refresh = () => refreshCount(controller.signal);
		refresh();
		window.addEventListener(ADMIN_FEEDBACK_COUNT_CHANGED_EVENT, refresh);
		window.addEventListener("focus", refresh);
		return () => {
			controller.abort();
			window.removeEventListener(ADMIN_FEEDBACK_COUNT_CHANGED_EVENT, refresh);
			window.removeEventListener("focus", refresh);
		};
	}, [refreshCount]);

	const label = t("newFeedbackNotifications", { count });
	return (
		<button
			type="button"
			data-testid="admin-feedback-notifications"
			aria-label={label}
			title={label}
			onClick={() => {
				onNavigate?.();
				router.push("/admin/feedback");
			}}
			className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-secondary transition hover:bg-surface-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
		>
			<Bell size={19} aria-hidden="true" />
			{count > 0 && (
				<span
					data-testid="admin-feedback-unread-count"
					aria-hidden="true"
					className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
				>
					{count > 99 ? "99+" : count}
				</span>
			)}
		</button>
	);
}
