export function createCredentialAttempt({ guard, selectSession, onUser,
	registerIntent = () => true, isCurrentIntent = () => true,
	createId = () => crypto.randomUUID().replaceAll("-", "") }) {
	let active = null;
	function invalidate() {
		const previous = active;
		active = null;
		previous?.controller.abort();
	}
	const isCurrent = attempt => Boolean(attempt) && active === attempt && guard.isCurrent(attempt.session) &&
		(!attempt.intentRegistered || isCurrentIntent(attempt.id));
	return {
		invalidate,
		isCurrent,
		isPending: () => active !== null,
		begin() {
			invalidate();
			guard.start(guard.getUser());
			const controller = new AbortController();
			const id = createId();
			active = { id, session: guard.capture(), controller, signal: controller.signal,
				intentRegistered: registerIntent(id) };
			return active;
		},
		cancel(attempt) { if (attempt && active === attempt) { invalidate(); return true; } return false; },
		commit(attempt, result) {
			if (!isCurrent(attempt) || !selectSession(attempt.id)) return false;
			active = null;
			guard.start(result.user);
			onUser(result.user);
			return true;
		},
	};
}

export const selectionCookie = "sj_auth_session";
export const intentCookie = "sj_auth_intent";
const readCookie = name => document.cookie.split(";").map(cookie => cookie.trim())
	.find(cookie => cookie.startsWith(`${name}=`))?.slice(name.length + 1);
function writePublicCookie(name, value) {
	try {
		const production = process.env.NODE_ENV === "production";
		document.cookie = `${name}=${value}; Path=/; Max-Age=2147483647; SameSite=${production ? "None" : "Lax"}${production ? "; Secure; Domain=.studyjony.com" : ""}`;
		return readCookie(name) === value;
	} catch { return false; }
}
export const registerCredentialIntent = id => writePublicCookie(intentCookie, id);
export const isCurrentCredentialIntent = id => readCookie(intentCookie) === id;
export const invalidateCredentialIntent = () => registerCredentialIntent(crypto.randomUUID().replaceAll("-", ""));
export const captureCredentialSession = () => readCookie(selectionCookie) || "legacy";

export function selectCredentialSession(id, { discardPrevious = true } = {}) {
	if (id !== "none" && !/^[a-f0-9]{32}$/.test(id)) return false;
	const previous = readCookie(selectionCookie);
	// This public selector carries no credential. JWTs remain HttpOnly.
	const selected = writePublicCookie(selectionCookie, id);
	if (discardPrevious && selected && previous !== id && /^[a-f0-9]{32}$/.test(previous || "")) discardCredentialAttempt(previous);
	return selected;
}

export async function discardCredentialAttempt(id) {
	try {
		await fetch("/api/v1/auth/credentials/discard", {
			method: "POST", credentials: "include",
			headers: { "X-StudyJony-Auth-Attempt": id },
		});
	} catch { /* Unselected cookies cannot authenticate; cleanup may retry on reload. */ }
}
