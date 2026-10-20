"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";
import { accountLanguage, guestLanguage, isLanguage, languagePath, saveGuestLanguage } from "@/app/_lib/languagePreference.mjs";

const LanguagePreferenceContext = createContext(null);

export function LanguagePreferenceProvider({ children, initialGuestLanguage }) {
	const { user, loading, setUser, captureSession, isCurrentSession } = useAuth();
	const locale = useLocale();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [save, setSave] = useState(null);
	const inFlight = useRef(null);
	const navigation = useRef(null);
	const query = searchParams.toString();
	const browserGuest = typeof document === "undefined" ? null : guestLanguage(document.cookie);
	const preferred = user ? accountLanguage(user) : browserGuest || initialGuestLanguage;
	const activeSave = save && isCurrentSession(save.session) ? save : null;
	const switching = Boolean(activeSave && !activeSave.failed && activeSave.language === preferred);
	const saving = Boolean(activeSave?.pending || (switching && locale !== preferred));
	const saveFailed = Boolean(activeSave?.failed);
	const selectedLanguage = activeSave && !activeSave.failed ? activeSave.language : locale;

	useEffect(() => {
		if (loading) return;
		if (!user && !guestLanguage(document.cookie)) saveGuestLanguage(preferred);
		document.documentElement.lang = locale;
		if (locale !== preferred) {
			// Successful auth flows already navigate to their destination. Let that
			// navigation complete rather than racing it back to a login/callback page.
			if (user && ["/login", "/signup", "/oauth/google/callback"].includes(pathname)) return;
			// Use the canonical URL directly; next-intl's explicit locale option
			// first adds /vi and requires another redirect for the default locale.
			const href = languagePath(pathname, preferred) + window.location.search;
			if (navigation.current?.href === href && isCurrentSession(navigation.current.session)) return;
			navigation.current = { href, session: captureSession() };
			router.replace(href, { scroll: false });
		} else navigation.current = null;
	}, [loading, user, preferred, locale, pathname, query, router, captureSession, isCurrentSession]);

	const saveLanguage = useCallback(async language => {
		if (loading || saving || !isLanguage(language) || (inFlight.current && isCurrentSession(inFlight.current))) return false;
		const session = captureSession();
		const request = { session, language, pending: true, failed: false };
		setSave(request);
		if (!user) {
			const saved = saveGuestLanguage(language);
			setSave({ ...request, pending: false, failed: !saved });
			return saved;
		}
		inFlight.current = session;
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
			setSave({ ...request, pending: false });
			return true;
		} catch {
			if (isCurrentSession(session)) setSave({ ...request, pending: false, failed: true });
			return false;
		} finally {
			if (inFlight.current === session) inFlight.current = null;
		}
	}, [loading, saving, captureSession, user, isCurrentSession, setUser]);

	return (
		<LanguagePreferenceContext.Provider value={{ saveLanguage, saving: saving || loading, saveFailed, selectedLanguage }}>
			{/* Keep the old page visible only for this session's own language switch.
			    Initial session restore and account changes still hide mismatched content. */}
			<div className={!loading && (locale === preferred || switching) ? "contents" : "contents invisible"}>{children}</div>
		</LanguagePreferenceContext.Provider>
	);
}

export const useLanguagePreference = () => useContext(LanguagePreferenceContext);
