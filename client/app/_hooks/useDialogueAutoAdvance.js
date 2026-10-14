"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useDialogueProgress } from "../_components/DialogueProgressSave";

// Both story and dialogue exercises use the same durable progress queue.
export default function useDialogueAutoAdvance({ onComplete, href }) {
	const router = useRouter();
	const progress = useDialogueProgress();
	const hasProgress = Boolean(progress);
	const loading = progress?.loading;
	const submitted = useRef(false);
	const navigating = useRef(false);
	const onCompleteRef = useRef(onComplete);
	const [completion, setCompletion] = useState(null);
	const [accepted, setAccepted] = useState(false);
	const [elapsed, setElapsed] = useState(false);

	useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
	useEffect(() => {
		if (!completion) return;
		const timer = setTimeout(() => setElapsed(true), 400);
		return () => clearTimeout(timer);
	}, [completion]);

	useEffect(() => {
		if (!completion || loading) return;
		let active = true;
		// A true result means durable queue acceptance or server confirmation.
		Promise.resolve().then(() => onCompleteRef.current?.(completion)).then(saved => {
			if (active) setAccepted(saved === true || !hasProgress);
		}).catch(() => { /* The existing progress notice owns save errors/retries. */ });
		return () => { active = false; };
	}, [completion, loading, hasProgress]);

	const safeToAdvance = !progress?.loading && (!progress || progress.canNavigate) &&
		(accepted || progress?.status === "saved");
	useEffect(() => {
		if (!elapsed || !safeToAdvance) return;
		const advance = () => {
			if (navigating.current || document.querySelector('[aria-modal="true"]')) return;
			navigating.current = true;
			router.push(href);
		};
		// Do not interrupt an exit/reminder dialog. Resume when it closes.
		const observer = new MutationObserver(advance);
		observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
		advance();
		return () => observer.disconnect();
	}, [elapsed, safeToAdvance, href, router]);

	return {
		isSubmitted: () => submitted.current,
		complete(input) {
			if (submitted.current) return;
			submitted.current = true;
			setCompletion(input);
		},
	};
}
