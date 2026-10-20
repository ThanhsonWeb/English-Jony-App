import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { resolveAccountLanguage } from "./i18n/accountLanguage.mjs";
import { GUEST_LANGUAGE_COOKIE, languagePath } from "./app/_lib/languagePreference.mjs";

const guestRouting = createMiddleware({
	...routing, localeCookie: { name: GUEST_LANGUAGE_COOKIE, sameSite: "lax", maxAge: 31536000 },
});
const accountRouting = createMiddleware({ ...routing, localeDetection: false });

export default async function proxy(request) {
	let response;
	if (request.method === "GET" && request.headers.get("rsc") === "1" && request.headers.get("sec-fetch-mode") !== "navigate") {
		// This header selects public translation rendering, never authentication.
		// Protected data is fetched separately from authenticated backend APIs.
		// The client context reconciles the locale with its confirmed session.
		response = accountRouting(request);
	} else {
		const account = await resolveAccountLanguage(request.headers.get("cookie") || "", process.env.NEXT_PUBLIC_API_URL);
		if (account.authenticated) {
			const pathname = languagePath(request.nextUrl.pathname, account.language);
			if (pathname !== request.nextUrl.pathname) {
				const url = request.nextUrl.clone();
				url.pathname = pathname;
				response = NextResponse.redirect(url);
			} else response = accountRouting(request);
		} else {
			// Unavailable auth is not proof of a guest; keep its cookie untouched.
			response = account.authenticated === false ? guestRouting(request) : accountRouting(request);
		}
	}
	response.headers.set("Cache-Control", "private, no-store");
	response.headers.append("Vary", "Cookie, Accept-Language");
	return response;
}

export const config = {
	matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
