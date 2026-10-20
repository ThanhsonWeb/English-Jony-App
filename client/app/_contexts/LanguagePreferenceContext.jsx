"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";
import { accountLanguage, guestLanguage, isLanguage, saveGuestLanguage } from "@/app/_lib/languagePreference.mjs";

const LanguagePreferenceContext = createContext(null);

export function LanguagePreferenceProvider({ children, initialGuestLanguage }) {
	const { user, loading, setUser, captureSession, isCurrentSession } = useAuth();
	const locale = useLocale();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [save, setSave] = useState(null);
	const inFlight = useRef(null);
	const browserGuest = typeof document === "undefined" ? null : guestLanguage(document.cookie);
	const preferred = user ? accountLanguage(user) : browserGuest || initialGuestLanguage;
	const saving = Boolean(save?.pending && isCurrentSession(save.session));
	const saveFailed = Boolean(save?.failed && isCurrentSession(save.session));

	useEffect(() => {
		if (loading) return;
		if (!user && !guestLanguage(document.cookie)) saveGuestLanguage(preferred);
		if (locale !== preferred) {
			// Successful auth flows already navigate to their destination. Let that
			// navigation complete rather than racing it back to a login/callback page.
			if (user && ["/login", "/signup", "/oauth/google/callback"].includes(pathname)) return;
			const query = searchParams.toString();
			router.replace(query ? `${pathname}?${query}` : pathname, { locale: preferred, scroll: false });
		}
		document.documentElement.lang = locale;
	}, [loading, user, preferred, locale, pathname, searchParams, router]);

	const saveLanguage = useCallback(async language => {
		if (loading || !isLanguage(language) || (inFlight.current && isCurrentSession(inFlight.current))) return false;
		const session = captureSession();
		if (!user) {
			const saved = saveGuestLanguage(language);
			setSave(saved ? null : { session, pending: false, failed: true });
			return saved;
		}
		const request = { session, pending: true, failed: false };
		inFlight.current = session;
		setSave(request);
		try {
			const response = await fetch("/api/v1/users/language", {
				method: "PATCH", credentials: "include", cache: "no-store",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ language, expectedUserId: session.userId }),
			});
			if (!isCurrentSession(session)) return false;
			const data = await response.json();
			if (!isCurrentSession(session)) return false;
			if (!response.ok || data.status !== "success" || data.data?.language !== language) throw new Error("Save failed");
			setUser(current => ({ ...current, language }));
			return true;
		} catch {
			if (isCurrentSession(session)) setSave({ ...request, pending: false, failed: true });
			return false;
		} finally {
			if (inFlight.current === session) inFlight.current = null;
			setSave(current => current === request ? null : current);
		}
	}, [loading, captureSession, user, isCurrentSession, setUser]);

	return (
		<LanguagePreferenceContext.Provider value={{ saveLanguage, saving: saving || loading, saveFailed }}>
			<div className={!loading && locale === preferred ? "contents" : "contents invisible"}>{children}</div>
		</LanguagePreferenceContext.Provider>
	);
}

export const useLanguagePreference = () => useContext(LanguagePreferenceContext);
