import path from "node:path";

export function getContentStorageDirectory(contentType = "dialogue") {
	if (contentType === "dialogue") return "dialogues";
	if (contentType === "story") return "stories";
	throw new Error(`Unsupported dialogue contentType: ${contentType}`);
}

export function getPublicAssetDirectory(contentType = "dialogue") {
	if (contentType === "dialogue") return "dialogue";
	if (contentType === "story") return "stories";
	throw new Error(`Unsupported dialogue contentType: ${contentType}`);
}

export function getPublicAssetPath(contentType = "dialogue", courseId, ...parts) {
	return `/${[getPublicAssetDirectory(contentType), courseId, ...parts].filter(Boolean).join("/")}`;
}

export function getGeneratedCourseDirectory(root, contentType, courseId) {
	return path.join(root, "generated", getContentStorageDirectory(contentType), courseId);
}

export function getCourseConfigPath(root, contentType, courseId) {
	return path.join(root, "scripts", "config", getContentStorageDirectory(contentType), `${courseId}.mjs`);
}

export function getDialogueDataCourseDirectory(root, contentType, courseId) {
	return path.join(
		root,
		"app",
		"[locale]",
		"(main)",
		"dialogue",
		"_data",
		getContentStorageDirectory(contentType),
		courseId,
	);
}

export function getGeneratedDialogueDraftPath(root, contentType, courseId, dialogueId) {
	return path.join(
		getGeneratedCourseDirectory(root, contentType, courseId),
		dialogueId,
		"draft.json",
	);
}

export function getDialogueDataJsonPath(root, contentType, courseId, dialogueId) {
	return path.join(
		getDialogueDataCourseDirectory(root, contentType, courseId),
		`${dialogueId}.json`,
	);
}
