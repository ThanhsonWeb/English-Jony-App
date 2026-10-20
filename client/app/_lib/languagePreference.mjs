export const DEFAULT_LANGUAGE = "vi";
export const GUEST_LANGUAGE_COOKIE = "sj_guest_language";
export const isLanguage = value => value === "vi" || value === "en";
export const accountLanguage = user => isLanguage(user?.language) ? user.language : DEFAULT_LANGUAGE;

export function guestLanguage(cookieHeader = "") {
	const value = cookieHeader.split(";").map(item => item.trim())
		.find(item => item.startsWith(`${GUEST_LANGUAGE_COOKIE}=`))?.split("=")[1];
	return isLanguage(value) ? value : null;
}

export function saveGuestLanguage(language) {
	if (!isLanguage(language)) return false;
	try {
		document.cookie = `${GUEST_LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
		return guestLanguage(document.cookie) === language;
	} catch { return false; }
}

export function languagePath(pathname, language) {
	const path = pathname.replace(/^\/(en|vi)(?=\/|$)/, "").replace(/^\/+/, "");
	return language === "en" ? `/en${path ? `/${path}` : ""}` : `/${path}`;
}
