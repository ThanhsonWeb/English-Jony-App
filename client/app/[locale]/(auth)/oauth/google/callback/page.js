"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";

export default function GoogleOAuthCallbackPage() {
	const router = useRouter();
	const { locale } = useParams();
	const { getMe } = useAuth();

	useEffect(() => {
		async function finishLogin() {
			try {
				await getMe();
				router.replace(`/${locale}/wordlist`);
			} catch {
				router.replace(`/${locale}/login?error=google-login-failed`);
			}
		}

		finishLogin();
	}, [getMe, locale, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#030616] text-white">
			Đang hoàn tất đăng nhập...
		</div>
	);
}
