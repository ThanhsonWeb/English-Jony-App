const GOOGLE_OAUTH_RETURN_PATH_KEY = "studyjony-google-oauth-return-path";

export function getSafeAuthReturnPath(value) {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
		return null;
	}
	if (/[\\?#\u0000-\u001f]/u.test(value)) return null;

	try {
		const parsed = new URL(value, "https://studyjony.invalid");
		if (parsed.origin !== "https://studyjony.invalid" || parsed.pathname !== value) {
			return null;
		}
		return parsed.pathname;
	} catch {
		return null;
	}
}

export function saveGoogleOAuthReturnPath(storage, value) {
	try {
		const returnPath = getSafeAuthReturnPath(value);
		if (returnPath) storage.setItem(GOOGLE_OAUTH_RETURN_PATH_KEY, returnPath);
		else storage.removeItem(GOOGLE_OAUTH_RETURN_PATH_KEY);
	} catch {
		// Authentication still works with the existing Wordlist fallback.
	}
}

export function readGoogleOAuthReturnPath(storage) {
	try {
		return getSafeAuthReturnPath(storage.getItem(GOOGLE_OAUTH_RETURN_PATH_KEY));
	} catch {
		return null;
	}
}

export function clearGoogleOAuthReturnPath(storage) {
	try {
		storage.removeItem(GOOGLE_OAUTH_RETURN_PATH_KEY);
	} catch {
		// A stale session value is still validated every time it is read.
	}
}
