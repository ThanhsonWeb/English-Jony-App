function isUsableAvatarUrl(url, isProduction) {
	if (!url) return false;
	if (url.startsWith("https://")) return true;
	if (isProduction) return false;
	return url.startsWith("http://") || url.startsWith("/api/v1/users/avatar-files/");
}

export function resolveAvatarUrl(
	user,
	failedUrls = [],
	{ isProduction = process.env.NODE_ENV === "production" } = {},
) {
	return [user?.avatar, user?.photo]
		.map((url) => typeof url === "string" ? url.trim() : "")
		.find((url) => isUsableAvatarUrl(url, isProduction) && !failedUrls.includes(url)) || "";
}
