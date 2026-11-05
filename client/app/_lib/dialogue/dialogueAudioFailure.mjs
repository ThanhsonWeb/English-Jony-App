export function getDialogueAudioFailureKind(line, error) {
	if (typeof line?.audioUrl !== "string" || !line.audioUrl.trim()) return "missing";
	if (error?.name === "AbortError") return null;
	return "failed";
}
