import { getAuthErrorMessage } from "./authErrorMessage.js";

export async function submitCredential(kind, credentials, t, attempt) {
	const fallback = kind === "signup" ? "signupFailed" : "loginFailed";
	if (!attempt) return { error: t(fallback) };
	try {
		const response = await fetch(`/api/v1/auth/credentials/${kind}`, {
			method: "POST", credentials: "include", signal: attempt.signal,
			headers: { "Content-Type": "application/json", "X-StudyJony-Auth-Attempt": attempt.id },
			body: JSON.stringify(credentials),
		});
		const data = await response.json().catch(() => null);
		const user = data?.data?.user;
		const userId = user?._id || user?.id;
		if (response.ok && data?.status === "success" && data?.data?.credentialAttempt === attempt.id &&
			user && !Array.isArray(user) && typeof userId === "string" && userId.trim()) return { user };
		return { error: response.status >= 500 ? t(fallback) : getAuthErrorMessage({
			message: typeof data?.message === "string" ? data.message : "", error: data?.error,
		}, t, fallback) };
	} catch {
		return { error: t(fallback) };
	}
}
