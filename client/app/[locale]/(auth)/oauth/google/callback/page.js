"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";

export default function GoogleOAuthCallbackPage() {
	const t = useTranslations("Auth");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { locale } = useParams();
	const { restoreSession, isCurrentSession } = useAuth();
	const navigated = useRef(false);
	const oauthError = searchParams.get("error");

	useEffect(() => {
		let cancelled = false;
		const prefix = locale === "en" ? "/en" : "";
		function navigate(path) {
			if (cancelled || navigated.current) return;
			navigated.current = true;
			router.replace(`${prefix}${path}`);
		}
		async function finishLogin() {
			if (oauthError) {
				navigate("/login?error=google_oauth_failed");
				return;
			}

			const result = await restoreSession("oauth");
			if (cancelled || result.status === "stale" || !isCurrentSession(result.session)) return;
			navigate(
				result.status === "success"
					? "/wordlist"
					: "/login?error=google_session_failed",
			);
		}

		finishLogin();
		return () => { cancelled = true; };
	}, [restoreSession, isCurrentSession, locale, oauthError, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#030616] text-white">
			{t("finishingGoogleLogin")}
		</div>
	);
}
