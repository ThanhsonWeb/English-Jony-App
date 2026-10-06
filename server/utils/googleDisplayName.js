// Keep provider names within the existing Mongoose limits (UTF-16 length).
function googleDisplayName(value) {
	if (typeof value !== "string") return "Google user";
	const normalized = value.normalize("NFC")
		.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, " ")
		.replace(/\s+/gu, " ").trim();
	if (!/[\p{L}\p{N}]/u.test(normalized)) return "Google user";
	let name = "";
	for (const { segment } of new Intl.Segmenter("und", { granularity: "grapheme" }).segment(normalized)) {
		if (name.length + segment.length > 20) break;
		name += segment;
	}
	name = name.trim();
	if (!name) return "Google user";
	return name.length < 3 ? `${name} (Google)` : name;
}

module.exports = googleDisplayName;
