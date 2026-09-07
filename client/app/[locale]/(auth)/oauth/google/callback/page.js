"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";

export default function GoogleOAuthCallbackPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { locale } = useParams();
	const { getMe } = useAuth();
	const oauthError = searchParams.get("error");

	useEffect(() => {
		async function finishLogin() {
			if (oauthError) {
				router.replace(`/${locale}/login?error=google_oauth_failed`);
				return;
			}

			const authenticatedUser = await getMe();
			router.replace(
				authenticatedUser
					? `/${locale}/wordlist`
					: `/${locale}/login?error=google_session_failed`,
			);
		}

		finishLogin();
	}, [getMe, locale, oauthError, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#030616] text-white">
			Đang hoàn tất đăng nhập...
		</div>
	);
}
