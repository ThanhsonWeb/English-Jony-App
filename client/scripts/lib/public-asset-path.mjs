export function getPublicAssetDirectory(contentType = "dialogue") {
	if (contentType === "dialogue") return "dialogue";
	if (contentType === "story") return "stories";
	throw new Error(`Unsupported dialogue contentType: ${contentType}`);
}

export function getPublicAssetPath(contentType = "dialogue", courseId, ...parts) {
	return `/${[getPublicAssetDirectory(contentType), courseId, ...parts].filter(Boolean).join("/")}`;
}
