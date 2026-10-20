import { accountLanguage } from "../app/_lib/languagePreference.mjs";

// Forward only the selected credential. Do not forward cleanup headers, which
// would turn this read into auth-cookie cleanup/revocation work.
export function selectedSessionCookies(cookieHeader = "") {
	const cookies = new Map(cookieHeader.split(";").filter(item => item.includes("=")).map(item => {
		const index = item.indexOf("=");
		return [item.slice(0, index).trim(), item.slice(index + 1).trim()];
	}));
	const selected = cookies.get("sj_auth_session");
	if (/^[a-f0-9]{32}$/.test(selected || "")) {
		const name = `sj_auth_${selected}`;
		return cookies.get(name) ? `sj_auth_session=${selected}; ${name}=${cookies.get(name)}` : null;
	}
	if ((selected === undefined || selected === "legacy") && cookies.get("jwt")) {
		return `jwt=${cookies.get("jwt")}`;
	}
	return null;
}

export async function resolveAccountLanguage(cookieHeader, apiBase, fetchImpl = fetch) {
	const selected = selectedSessionCookies(cookieHeader);
	if (!selected) return { authenticated: false };
	try {
		if (!apiBase) return { authenticated: null };
		const response = await fetchImpl(`${apiBase.replace(/\/+$/, "")}/api/v1/users/me`, {
			headers: { Cookie: selected, "Cache-Control": "no-store" },
			cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000),
		});
		if (response.status === 401) return { authenticated: false };
		if (!response.ok) return { authenticated: null };
		const data = await response.json();
		const user = data?.data?.user;
		const id = user?._id || user?.id;
		if (data?.status !== "success" || typeof id !== "string" || !id.trim()) {
			return { authenticated: null };
		}
		return { authenticated: true, language: accountLanguage(user) };
	} catch {
		// Do not log credentials or substitute another account's saved value.
		return { authenticated: null };
	}
}
