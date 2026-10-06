import { getAuthErrorMessage } from "./authErrorMessage.js";

export async function loginWithPassword(credentials, t) {
	try {
		const response = await fetch("/api/v1/auth/login", {
			method: "POST", credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(credentials),
		});
		const data = await response.json().catch(() => null);
		const user = data?.data?.user;
		const userId = user?._id || user?.id;
		if (response.ok && data?.status === "success" && user && !Array.isArray(user) && typeof userId === "string" && userId.trim()) {
			return { user };
		}
		// Only known failures become specific translations. Never display API text.
		const error = response.status >= 500 ? t("loginFailed") : getAuthErrorMessage({
			message: typeof data?.message === "string" ? data.message : "",
			error: data?.error,
		}, t, "loginFailed");
		return { error };
	} catch {
		return { error: t("loginFailed") };
	}
}
