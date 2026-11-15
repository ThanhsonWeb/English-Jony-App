export const ACCOUNT_DELETION_CONFIRMATION = "DELETE MY ACCOUNT";

export function isAccountDeletionUiEnabled(value) {
	return value === "true";
}

export function canRequestPasswordAccountDeletion(user) {
	return user?.canRequestPasswordAccountDeletion === true;
}

export function isAccountDeletionConfirmationValid(value) {
	return value === ACCOUNT_DELETION_CONFIRMATION;
}

export async function submitAccountDeletionRequest(currentPassword, fetchImpl = globalThis.fetch) {
	if (typeof currentPassword !== "string" || !currentPassword || typeof fetchImpl !== "function") {
		return { ok: false, status: 0, data: null };
	}

	const response = await fetchImpl("/api/v1/users/request-account-deletion", {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			confirmation: ACCOUNT_DELETION_CONFIRMATION,
			currentPassword,
		}),
	});
	const data = await response.json().catch(() => null);

	return {
		ok: response.ok && data?.status === "success" && data?.data?.requested === true,
		status: response.status,
		data,
	};
}
